var scriptName = Path.basename(__filename);
registerCommand(scriptName, 'modules', Context.elevated, doModules);

function doModules (message,param){
	var moduleList = [];

	fs.readdir('.\\module', function(err, items){
		if (err) return;
		
		var Modules = nconf.get('modules');

		items.forEach(function(item){
			// Only look at JS files
			var ext = item.split('.').slice(-1);
			var module = item.replace(/.js$/i,'');
			if (ext != 'js') return;
			
			if (Modules.find(item => item === module)) module = '[' + module + ']';
			module = '`' + module + '`';
			
			moduleList.push(module);
		});
		
		callbackModules(message, moduleList);
	}, callbackModules);
}

function callbackModules(message, moduleList) {
	moduleList.sort();
	message.channel.sendMessage(moduleList.join(' '));
}