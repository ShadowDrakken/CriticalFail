var scriptName = Path.basename(__filename);
registerCommand(scriptName, 'op', Context.elevated, doCommandOp);

function doCommandOp(message, param) {
	if (param.length > 0) {
		var opList = nconfMain.get('opList');

		// This should already be handled by the bot, but we want to be doubley sure.
		if (!isOp(message.author.id)) return;
		
		switch (param[0]) {
			case 'list':
				var retMessage = '';
				
				opList.forEach(function(op) {
					retMessage += getMentionFromId(op.id) + ', '
				});
				retMessage = retMessage.replace(/, $/g,'')
				
				message.channel.sendMessage('Op List: ' + retMessage);
				break;
			case 'add':
				param.splice(0,1);
				
				param.forEach(function(mention){
					if (!mention) return;
					if (!message.channel.guild) return;
					
					var user = message.channel.guild.members.get(getIdFromMention(mention)).user;
					
					if (!user) {
						message.channel.sendMessage('Unable to add '+ mention +' to op list. Invalid user.');
					} else if (opList.find(x => x.id === user.id)) {
						if (message.author.id === user.id)
							message.channel.sendMessage('You are already an op.');
						else
							message.channel.sendMessage(mention + ' is already an op.');
					} else {
						var op = {id:user.id, username:user.username, discriminator:user.discriminator};
						
						opList.push(op);
						message.channel.sendMessage('Added ' + mention + ' to the op list.');
					}
				});
				
				nconfMain.set('opList', opList);
				saveConfig();
				break;
			case 'remove':
				param.splice(0,1);
				
				param.forEach(function(mention){
					if (!mention) return;
					if (!message.channel.guild) return;

					var user = message.channel.guild.members.get(getIdFromMention(mention)).user;
					
					if (!user) {
						message.channel.sendMessage('Unable to remove '+ mention +' from op list. Invalid user.');
					} else if (!opList.find(x => x.id === user.id)) {
						message.channel.sendMessage(mention + ' is not currently an op.');
					} else if (message.author.id === user.id) {
						message.channel.sendMessage('You cannot remove yourself from the op list.');
					} else {
						opList.splice(opList.find(x => x.id === user.id),1);
						message.channel.sendMessage('Removed ' + mention + ' from the op list.');
					}
				});
				
				nconfMain.set('opList', opList);
				saveConfig();
				break;
			default:
				break;
		}
		
	}
}