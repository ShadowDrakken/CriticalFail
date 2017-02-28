var scriptName = Path.basename(__filename);
registerCommand(scriptName, 'commands', Context.info, doCommandListCommands);

function doCommandListCommands(message, param) {
	var commandList = [];
	
	Commands.forEach(function(cmd){
		if (message.channel.type === 'dm' || !(cmd.direct)) {
			var listItem = '`' + cmd.context + cmd.command + '`';
			var listItemMultiple = '`' + cmd.context + cmd.command + '`*';
			if (commandList.find((item) => item === listItem)) {
				commandList.splice(commandList.indexOf(listItem),1);
				commandList.push(listItemMultiple);
			} else if (commandList.find((item) => item === listItemMultiple)) {
				// Do nothing, it's already in as a multi-command
			} else {
				commandList.push(listItem);
			}
		}
	});
	
	commandList.sort();	
	message.channel.sendMessage(commandList.join(' '));
}