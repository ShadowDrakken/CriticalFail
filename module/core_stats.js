var scriptName = Path.basename(__filename);
registerCommand(scriptName, doStats, 'stats', Context.elevated);

var nconfStats = new nconf.Provider();
nconfStats.use('file', { file: './config/'+ scriptName.replace(/.js$/i, '') +'.json' });
nconfStats.defaults({
	'server': [],
	'channel': []
});
nconfStats.load();

global.registerPeek = function(owner, func, command, context, direct) {
}

function doStats(message,param) {}