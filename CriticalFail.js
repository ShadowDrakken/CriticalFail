global.nconf = require('nconf');
global.Discord = require('discord.js');
global.Path = require('path');
global.fs = require('fs');
global.Reload = require('require-reload')(require);
global.client = new Discord.Client();
global.Commands = [];
global.Context = {
	elevated: '&',
	task: '!',
	info: '?'
	}
var Domain = require('domain').create();
global.LoadedModules = [];
global.HelpTopics = [];

Domain.on('error', (err) => {
	console.log(err.stack);
});

client.on('ready', () => {
	console.log('Client ready.');
});

client.on('message', message => {
	// Lets not talk to ourselves, shall we
	if (message.author.id === client.user.id) return;
	
	var context = (message.content).substring(0,1);
	
	// No point doing a bunch of work if the context is invalid
	var validContext = false;
	for (var i in Context) {
		if (Context[i] === context) {
			validContext = true;
			break;
		}
	}	
	if (!validContext) return;
	
	// Split the message into individual parameters
	var param = message.content.split(' ');
	
	// Clean empty parameters
	param = param.filter(function(n){ return n != undefined }); 

	// Convert the first parameter into a command
	var command = param[0].substring(1).toLowerCase();
	param.splice(0,1);
	
	// Check if there's a matching command and context registered
	Commands.forEach(function(cmd){
		if (cmd.context === context && cmd.command === command) {
			// Automatically handle permission on all elevated commands.
			if (context === Context.elevated && !(message.channel.type === 'dm')) return;
			if (context === Context.elevated && !isOp(message.author.id)) return;

			// Private commands can only be run in direct message conversations
			if (cmd.direct && !(message.channel.type === 'dm')) return;
			
			// Run the command
			Domain.run(() => {
				cmd.func(message, param);
			});
		}
	});
});

nconf.use('file', { file: './CriticalFail.json' });
nconf.defaults({
	'loginToken': '',
	'opList': [],
	'modules' : ['core_load', 'core_op', 'core_modules', 'core_commands', 'core_help']
});
nconf.load();

client.login(nconf.get('loginToken'));

global.isOp = function(id) {
	var opList = nconf.get('opList');
	
	if (opList.find(x => x.id === id))
		return true;
	else
		return false;
}

global.saveConfig = function() {
	nconf.save(function(err){
		if (err) {
			console.error(err.message);
			return;
		}
		console.log('Configuration saved successfully.');
	});
}

global.getIdFromMention = function(mention) {
	return mention.replace(/^<@/g,'').replace(/>$/g,'')
}
global.getMentionFromId = function(id) {
	return '<@' + id + '>';
}

global.registerCommand = function(owner, command, context, func, direct) {
	if (!typeof(func) === 'function') return false;
	
	// Check if there's a matching command and context registered and remove the previous version
	Commands.forEach(function(cmd) {
		if (cmd.context === context && cmd.command === command) {
			console.log('Replacing existing command: ' + cmd.context + cmd.command);
			Commands.splice(Commands.indexOf(existingCommand), 1);
		}
	});
	
	// Elevated commands can only be direct messages
	if (context === Context.elevated)
		direct = true;
	
	// Build the command object and add it to the list of loaded commands
	var cmd = {owner:owner, context:context, command:command.toLowerCase(), func:func, direct:direct}
	var cmdExists = false;
	Commands.forEach(function(item) {
		if (item.owner === cmd.owner && item.context === cmd.context && item.command === cmd.command)
			cmdExists = true;
	});
	
	if (!cmdExists)
		Commands.push(cmd);
	
	console.log('[' + owner + '] Command registered: ' + cmd.context + cmd.command);
	
	return true;
}

global.loadModules = function(modulePath,message) {
	var Modules = nconf.get('modules');
	if (!modulePath) {
		var loadList = [];
		
		fs.readdir('.\\module', function(err, items){
			if (err) return;
			
			items.forEach(function(fileName){
				var moduleName = fileName.replace(/.js$/i,'');
				
				if (Modules.find((module) => module === moduleName)) {
					loadList.push(fileName);
				}
			});
			
			loadModuleList(message,loadList);
		});
	} else {
		if (!Modules.indexOf(modulePath.replace(/.js$/i,''))) {
			Modules.push(modulePath.replace(/.js$/i,''));
		}
		//Modules.sort();
		nconf.set('modules', Modules);
		saveConfig();
		loadModuleList(message,[modulePath]);
	}
}

function loadModuleList(message,loadList) {
	loadList.forEach(function(item) {
		// Only load JS files
		var ext = item.split('.').slice(-1);
		var moduleName = item.replace(/.js$/i,'');
		if (ext != 'js') return;
		
		var modulePath = './module/' + item;
		
		if (fs.statSync(modulePath).isFile) {
			module = Reload(modulePath);
			LoadedModules.push({moduleName:module});
			if (message) message.channel.sendMessage('Module `' + moduleName + '` loaded.');
		} else {
			if (message) message.channel.sendMessage('Unable to find module `' + moduleName + '`');
		}
	});
}

loadModules();
