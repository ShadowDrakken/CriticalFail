var scriptName = Path.basename(__filename);
registerCommand(scriptName, 'help', Context.info, doHelp);

function doHelp(message,param){
	if (!param) {
		message.channel.sendMessage('Usage: help [module] command [topic]');
		return;
	}
	
	message.channel.sendMessage();
}

function getTopic(topic) {
	switch (topic) {
		default:
			retValue = 'Provides help on commands and subtopics.';
			break;
	}
	
	return retValue;
}