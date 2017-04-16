var scriptName = Path.basename(__filename);
registerCommand(scriptName, doLoad, 'load', Context.elevated);
registerCommand(scriptName, doUnload, 'unload', Context.elevated);

function doLoad(message,param){
	if (param.length > 0) {
		var Modules = nconfMain.get('modules');
		
		param.forEach(function(module) {
			var moduleFile = module + '.js';
			var modulePath = './module/' + moduleFile;
			
			// Unload the module before reloading
			if (Modules.find((item) => item === module))
				doUnload(message, [module], true);
			
			loadModules(moduleFile,message);
		});
	} else {
		loadModules();
		message.channel.sendMessage('All modules reloaded.');
	}
}

function doUnload(message,param){
	doUnload(message,param,false);
}
function doUnload(message,param,silent){
	if (param.length > 0) {
		var Modules = nconfMain.get('modules');
		
		param.forEach(function(module) {
			var moduleFile = module + '.js';
			var modulePath = './module/' + moduleFile;
			
			// This module should not be able to unload itself to prevent losing the ability to load modules
			if (moduleFile === scriptName) {
				if (!silent) message.channel.sendMessage('Module `' + module + '` cannot unloaded itself.');
				return;
			}
			
			var moduleRealPath = Path.resolve(modulePath);
			
			// Remove existing commands since the module is being unloaded
			var newCommandList = [];
			Commands.forEach(function(cmd) {
				if (cmd.owner === moduleFile) {
					console.log('[' + cmd.owner + '] Unregistered command: ' + cmd.context + cmd.command);
				} else {
					newCommandList.push(cmd);
				}
			});
			Commands = newCommandList;
			
			if (require.cache[moduleRealPath]) {
				var newModuleList = []
				Modules.forEach(function(item) {
					if (item != module) {
						newModuleList.push(item);
					}
				});
				Modules = newModuleList;
				
				delete require.cache[moduleRealPath];
				delete LoadedModules[module];
				if (!silent) message.channel.sendMessage('Module `' + module + '` unloaded.');
			} else {
				if (!silent) message.channel.sendMessage('Module `' + module + '` is not currently loaded.');
			}
		});
		
		if (!silent) {
			nconfMain.set('modules', Modules);
			saveConfig();
		}
	}
}
