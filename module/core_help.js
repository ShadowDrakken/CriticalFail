var scriptName = Path.basename(__filename);
registerCommand(scriptName, doHelp, 'help', Context.info, true);

global.Terms = []

global.registerHelpTerm = function (owner, func, term) {
	if (!typeof(func) === 'function') return false;

	// Check if there's a matching term registered and remove the previous version
	Terms.forEach(function(help) {
		if (help.term === term) {
			console.log('Replacing existing help term: ' + help.term);
			Terms.splice(Terms.indexOf(help), 1);
		}
	});
	
	// Build the help object and add it to the list of loaded terms
	var help = {owner:owner, term:term, func:func}
	var helpExists = false;
	Commands.forEach(function(item) {
		if (item.owner === help.owner && item.term === help.term)
			helpExists = true;
	});
	
	if (!helpExists)
		Terms.push(help);
	
	console.log('[' + owner + '] Help term registered: ' + help.term);
	
	return true;}

global.unregisterHelpTerms = function (owner) {
// Check if there's a matching command and context registered and remove the previous version
	Terms.forEach(function(help) {
		if (help.owner === owner) {
			console.log('Unregistering help term: ' + help.term);
			Terms.splice(Terms.indexOf(help), 1);
		}
	});
}

function doHelp(message,param){
	var hasReturn = false;
	const msgEmbed = new Discord.RichEmbed()
			.setTitle(getNickname(message));

	if (!param || param.length == 0) {
		showTopics(msgEmbed);
		hasReturn = true;
	} else {
		// Check if there's a matching term registered and respond
		Terms.forEach(function(help) {
			if (help.term === param[0]) {
				help.func(msgEmbed, param);
				hasReturn = true;
			}
		});
	}
	
	if (hasReturn)
		message.channel.send({embed: msgEmbed, disableEveryone: true }).catch(console.error);
}

function getTopic(topic) {
	switch (topic) {
		default:
			retValue = 'Provides help on commands and subtopics.';
			break;
	}
	
	return retValue;
}

function showTopics(msgEmbed) {
	var topics = [];
	Terms.forEach(function(help) {
		topics.push(help.term);
	});
	msgEmbed.addField('Available Help Topics', topics.join(', '));
}
