var scriptName = Path.basename(__filename);
registerCommand(scriptName, doInit, 'init', Context.task);

var nconfInit = new nconf.Provider();
nconfInit.use('memory');
nconfInit.defaults({
	'players': []
});
nconfInit.load();

function doInit(message,param) {}