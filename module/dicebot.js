var scriptName = Path.basename(__filename);
registerCommand(scriptName, doCommandRoll, 'roll', Context.task);
registerHelpTerm(scriptName, doHelpRoll, 'roll');

registerCommand(scriptName, doCommandMacro, 'macro', Context.task);
registerHelpTerm(scriptName, doHelpMacro, 'macro');

var nconfDice = new nconf.Provider();
nconfDice.use('file', { file: './config/'+ scriptName.replace(/.js$/i, '') +'.json' });
nconfDice.defaults({
	'global': []
});
nconfDice.load();

function doHelpRoll(msg, param) {
	msg.addField('Complex dice example',`
4d6+2k3e6l1t4s4x6 i:Comment
4d6+2 K3 E6L1 T4S4 X6 I:Comment

4d6 - roll a d6 four times, modify the pool by the keeps, then total the remaining pool
+2 - add 2 to the total roll after applying keeps and explodes, but before applying successes; can also use -2 for subtraction

K3 - keep the highest 3 die; can also use K-3 to keep the lowest 3
E6 - explode the dice on anything 6 or higher
  L1 - limit explosions to 1 iteration, leave off for unlimited explosions
T4 - count the number of successes that meet the target value 4+
  S4 - count additional successes every 4 past the target
X6 - roll a new set and present results 4 times

I - Ignore modifiers added by macros. No effect when manually rolling.

:Comment - display the comment with the returned results
`);

	msg.addField('Notes',`
* No expression may be used more than once.
* Spaces between expressions are optional.
* Expressions can occur in any order, with the exception of the dice expression which must be at the beginning and :comments which must occur at the end of the expression.
* Expressions are case-insensitive.
`);
}

function doHelpMacro(msg, param) {
	msg.addField('Managing Macros',`
[~]<command> <expression> - Creates a macro using standard dice notation.
[~]<command> remove- Removes the specified macro.
[~]<command> - Shows the saved macro expression.
list - Shows all registered macros. Personal macros are only displayed privately.
verbose - As per 'list', but additionally associated expressions are displayed.
`);

	msg.addField('Notes',`
* Macro names can only contains alphanumeric characters, underscores and hyphens
* Prefixing a macro with ~ will make it globally available, otherwise macros are saved per-user.
* Macros are case-insensitive.
`);
}

function doCommandRoll(message,param){
	var expression = param.join(' ');
	var comment = '';
	
	// separate out the comment in advance
	if (expression.match(/[:]/g)) {
		comment = expression.split(':')[1].replace(/\s+$|^\s+/,'');
		expression = expression.split(':')[0].toLowerCase();
	}
	
	// Is this an expression, or a macro, or invalid?
	if (isExpression(expression)) {
		doRollDice(message, param, expression, comment);		
	} else if (isMacro(message.author.id, param[0])) {
		doRollMacro(message, param, comment);
	} else {
		// Prepare RichEmbed message
		const msgEmbed = new Discord.RichEmbed()
			.setTitle(getNickname(message));
		
		// Put the comment into the message description
		if (comment) msgEmbed.setDescription(comment);

		msgEmbed.addField('Error [' + expression + ']', 'Invalid expression.');

		message.channel.send({embed: msgEmbed});
	}
}

function doRollMacro(message,param,comment) {
	var macro = param.splice(0,1)[0].toLowerCase();
	var tail = param.length > 0 ? param.join(' ') : '';
	
	if (tail == '') {
		var modifier = 0;
	} else if (tail.match(/:/g)) {
		//var modifiers = tail.split(':')[0].replace(' ','').split(';');
		var modifier = parseInt(tail.split(':')[0].replace(' ',''));
	} else {
		//var modifiers = [];
		var modifier = parseInt(tail.replace(' ',''));
	}
	
	// Prepare RichEmbed message
	const msgEmbed = new Discord.RichEmbed()
		.setTitle(getNickname(message));
	
	var userid = message.author.id;
	
	if (macro[0] == '~') {
		// Global macro
		var expression = nconfDice.get('global:'+ macro.replace('~',''));
	} else {
		// Personal macro		
		var expression = nconfDice.get('personal:'+ userid +':macros:'+ macro.replace('~',''));
	}
	
	if (expression.match(/:/g)) {
		var macroComment = expression.split(':')[1];
		
		if (comment) {
			comment = macroComment +' ['+ comment +']';
		} else {
			comment = macroComment;
		}
		
		expression = expression.split(':')[0];
	}
	
	doRollDice(message,param,expression,comment,modifier);
}

function doRollDice (message,param,expression,comment) {
	var modifier = 0;
	doRollDice(message, param, expression, comment, modifier);
}

function doRollDice (message,param,expression,comment,modifier) {
	if (!modifier) modifier = 0;
	
	// Prepare RichEmbed message
	const msgEmbed = new Discord.RichEmbed()
		.setTitle(getNickname(message));
	
	// Put the comment into the message description
	if (comment) msgEmbed.setDescription(comment);

	// Compact and split the expression
	expression = expression.replace(/ /g, '');
	if (expression.match(/[;]/g)) {
		var expSplit = expression.split(';');
	} else {
		var expSplit = [expression];
	}

	if (expSplit.length > 4) return;
	
	for (var index in expSplit) {
		var expSingle = expSplit[index];
		
		// Validate the input is a valid dice roll with valid expressions
		var validated = expSingle.match(/^((?:\d+[d]\d+)(?:(?:[+]|[-])\d+){0,1})((?:(?:(?:(?:(?:[xelts])|(?:[k][-]{0,1}))\d+)|[i])*))/i);
		if (!validated) {
			msgEmbed.addField('Error [' + expSingle + ']', 'Invalid expression.');
			return;
		}

		// Split the dice portion of the expression into dice, sides and modifier
		var expDice = validated[1].match(/(\d+)[d](\d+)((?:[+]|[-])\d+){0,1}/i);
		
		// Separate and split the expressions, allowing for optional spacing for compactness vs readability
		var expMods = validated[2] ? validated[2].replace(/[xelkts]/gi,' $&').replace(/^\s+/,'').split(' ') : [];
			
		// Validate number of dice and dice sides
		if (expDice[1] > 50 || expDice[2] > 100) {
			msgEmbed.addField('Error [' + expSingle + ']', 'Too many dice or dice sides.');
			return;
		}

		var repeats = 1;
		var explosion = undefined;
		var explosionLimit = undefined;
		var keeps = undefined;
		var target = undefined;
		var successive = undefined;
		var ignoreMod = false;

		// Break out advanced expressions
		expMods.forEach(function(item) {
			var expFunction = item.substring(0,1);
			var expValue = parseInt(item.replace(expFunction,''));
			
			switch (expFunction.toLowerCase()) {
				case 'x':
					// Too many repeats can prevent proper message display, as well as taking inordinate amounts of time
					repeats = expValue <= 10 ? expValue : 10;
					break;
				case 'e':
					// exploding on 1's creates an infinite loop, this will ensure the dice will EVENTUALLY stop exploding
					explosion = expValue >= 2 ? expValue : 2;
					break;
				case 'l':
					explosionLimit = expValue;
					break;
				case 'k':
					keeps = expValue;
					break;
				case 't':
					target = expValue;
					break;
				case 's':
					successive = expValue;
					break;
				case 'i':
					ignoreMod = true;
					break;
				default:
			}
		});
		
		var RollSets = [];
		
		// handles counting successes
		function countSuccesses(dieRoll) {
			if (dieRoll < target) return 0;
			
			dieRoll -= target;
			var total = 1;
			
			if (successive)
				total += parseInt(dieRoll / successive);
				
			return total;
		}
		
		for (var i = 0; i < repeats; i++) {
			// Roll the dice and store them in a list, handling explosions as additional rolls
			var diceRolls = [];

			var thisRoller = function(){ return RollDie(parseInt(expDice[2]));}
			var diceQty = parseInt(expDice[1])
			for (var x=0; x < diceQty; x++) {
				if (!explosion) {
					var d = thisRoller()
					var diceSum = d;
					diceRolls.push({dice:[d], dropped:[], sum:diceSum});
				} else {
					var y = 0;
					var done = false;
					var diceSet = [];
					do {
						y++;
						var d = thisRoller()
						diceSet.push(d);
						if (d < explosion || explosionLimit && y >= explosionLimit) done = true;
					} while(done === false);
					diceSum = diceSet.reduce(function(a,b) {return a + b;}, 0);
					diceRolls.push({dice:diceSet, dropped:[], sum:diceSum});
				}
			}
			
			var keepRolls = [];
			var dropRolls = [];
			
			// handle keeps
			if (keeps && diceRolls.length > keeps) {
				dropRolls = diceRolls;
				
				for(var x=keeps; Math.abs(x) > 0; keeps === Math.abs(keeps) ? x-- : x++) {
					var min = Infinity;
					var max = -Infinity;
					var minRoll = undefined;
					var maxRoll = undefined;
					
					for(var y in dropRolls) {
						if (dropRolls[y].sum < min){
							min = dropRolls[y].sum;
							minRoll = dropRolls[y];
						}
						if (dropRolls[y].sum > max){
							max = dropRolls[y].sum;
							maxRoll = dropRolls[y];
						}
					}

					if (keeps === Math.abs(keeps)) {
						keepRolls.push(maxRoll);
						dropRolls.splice(dropRolls.indexOf(maxRoll),1);
					} else {
						keepRolls.push(minRoll);
						dropRolls.splice(dropRolls.indexOf(minRoll),1);
					}
				}
				
				diceRolls = keepRolls;
			}

			var outRolls = '';
			var outDropped = '';
			var total = 0;
			diceRolls.forEach(function(diceSet){
				var outSet = '['+ diceSet.dice.join('][') +']';
				if (diceSet.dice.length > 1)
					outSet = '['+ outSet +']';
				outRolls += outSet;
			});
			dropRolls.forEach(function(diceSet){
				var outSet = '['+ diceSet.dice.join('][') +']';
				if (diceSet.dice.length > 1)
					outSet = '['+ outSet +']';
				outDropped += outSet;
			});
			
			if (outDropped) outDropped = ' ~~`'+ outDropped + '`~~';
			
			var mod = (expDice[3] ? parseInt(expDice[3]) : 0) + (ignoreMod ? 0 : modifier);

			if (mod == 0) {
				var expModifier = '';
			} else if (mod > 0) {
				var expModifier = '+'+ mod;
			} else {
				var expModifier = mod
			}

			if (target) {
				total = countSuccesses(diceRolls.reduce(function(a,b) {return a + b.sum}, 0) + mod);
			} else {
				total = diceRolls.reduce(function(a,b) {return a + b.sum}, 0) + mod;
			}
			
			RollSets.push(('`'+ expDice[1] +'d'+ expDice[2] + expModifier + '`=`'+ outRolls +'`'+ outDropped +'=`'+ total +'`').trim());
		}
		
		msgText = RollSets.join("\r\n");

		// Add results of this expression to the RichEmbed
		msgEmbed.addField('Rolling [' + expDice[1] +'d'+ expDice[2] + expModifier + expMods.join('') +']', msgText);
	}
	
	// Send RichEmbed message to channel
	message.channel.send({embed: msgEmbed, disableEveryone: true }).catch(console.error);
}

function isExpression(expression) {
	// Compact and split the expression
	expression = expression.replace(/ /g, '');
	if (expression.match(/[;]/g)) {
		var expSplit = expression.split(';');
	} else {
		var expSplit = [expression];
	}

	for (var index in expSplit) {
		var expSingle = expSplit[index];
		
		// Validate the input is a valid dice roll with valid expressions
		var validated = expSingle.match(/^((?:\d+[d]\d+)(?:(?:[+]|[-])\d+){0,1})((?:(?:(?:(?:(?:[xelts])|(?:[k][-]{0,1}))\d+)|[i])*))/i);
		if (!validated) {
			return false;
		}
	}
	return true;
}

function doCommandMacro(message,param) {
	if (!param || param.length == 0) return;
	
	var macro = param.splice(0,1)[0].toLowerCase();

	// Prepare RichEmbed message
	const msgEmbed = new Discord.RichEmbed()
		.setTitle(getNickname(message));
	
	if (param.length == 0) {
		var command = 'show';
	} else {
		var command = param[0];
	}
	
	if (['list'].indexOf(macro) >= 0) {
		listMacros(message,msgEmbed,false);
	} else if (['verbose'].indexOf(macro) >= 0) {
		listMacros(message,msgEmbed,true);
	} else if (['show','view'].indexOf(command) >= 0) {
		// If a macro was given with no data, display the macro
		if (!isMacro(message.author.id,macro)) {
			msgEmbed.addField('Error ['+ command +']', 'Unknown macro ['+ macro +'].');
		} else {
			if (macro[0] == '~') {
				// Global macro
				var expression = nconfDice.get('global:'+ macro.replace('~',''));
			} else {
				// Personal macro
				var expression = nconfDice.get('personal:'+ message.author.id +':macros:'+ macro.replace('~',''));
			}
			msgEmbed.addField('Macro ['+ macro +']', expression);
		}
	} else if (['remove','delete','clear'].indexOf(command) >= 0) {
		// Does the macro exist?
		if (!isMacro(message.author.id,macro)) {
			msgEmbed.addField('Error [' + command + ']', 'Unknown macro [' + macro + '].');
		} else {
			unsetMacro(message.author.id,msgEmbed,macro);
		}
	} else {
		// Merge the expression
		var expression = param.join(' ');
		
		// Validate the macro name and expression
		if (isValidMacroName(macro) && isExpression(expression)) {
			// If everything passes, create the macro
			setMacro(message.author.id,msgEmbed,macro,expression);
		} else {
			msgEmbed.addField('['+ macro +'] Invalid expression.', expression);
		}		
	}
	
	message.channel.send({embed: msgEmbed});
}

function setMacro(userid,msgEmbed,macro,expression) {
	if (macro[0] == '~') {
		// Global macro, requires oper status to create or remove
		if (!isOp(userid)) {
			msgEmbed.addField('Error', 'Must be an oper to create global macros.');
		} else {
			nconfDice.set('global:'+ macro.replace('~',''), expression);
		}
	} else {
		// Personal macro		
		if (!userid) {
			msgEmbed.addField('Error', 'Unknown user.');
			return;
		} else {
			nconfDice.set('personal:'+ userid +':macros:'+ macro.replace('~',''), expression);
		}
	}
	
	msgEmbed.addField('Macro successfully created.', macro +' ['+ expression +']');
	saveDiceConfig();
}

function unsetMacro(userid,msgEmbed,macro) {
	if (macro[0] == '~') {
		// Global macro, requires oper status to create or remove
		if (!isOp(userid)) {
			msgEmbed.addField('Error', 'Must be an oper to remove global macros.');
		} else {
			var expression = nconfDice.get('global:'+ macro.replace('~',''));
			nconfDice.clear('global:'+ macro.replace('~',''));
		}
	} else {
		// Personal macro		
		if (!userid) {
			msgEmbed.addField('Error', 'Unknown user.');
			return;
		} else {
			var expression = nconfDice.get('personal:'+ userid +':macros:'+ macro.replace('~',''));
			nconfDice.clear('personal:'+ userid +':macros:'+ macro.replace('~',''));
			
			var macrosRemaining = nconfDice.get('personal:'+ userid +':macros');
			if (Object.keys(macrosRemaining).length < 1) {
				nconfDice.clear('personal:'+ userid);
			}
		}
	}
	
	msgEmbed.addField('Macro successfully removed.', macro +' ['+ expression +']');
	saveDiceConfig();	
}

function listMacros(message, msgEmbed, verbose) {
	var globalMacros = nconfDice.get('global');
	if (globalMacros) {
		var keys = Object.keys(globalMacros);
		for (var index in keys) {
			if (!verbose) {
				keys[index] = '~'+ keys[index];
			} else {
				keys[index] = '~'+ keys[index] +' ['+ globalMacros[keys[index]] + ']';
			}
		}
		
		if (keys.length > 0)
			msgEmbed.addField('Global Macros', keys.join(', '));
	}	
	
	if (message.channel.type === 'dm') {
		var personalMacros = nconfDice.get('personal:'+ message.author.id +':macros');
		var keys = Object.keys(personalMacros);

		if (verbose) {
			for (var index in keys) {
				keys[index] = keys[index] +' ['+ personalMacros[keys[index]] + ']';
			}
		}

		if (personalMacros)
			msgEmbed.addField('Personal Macros', keys.join(', '));
	}
	
	if (globalMacros.length == 0 && !personalMacros)
		msgEmbed.setDescription('No macros have been created.');
}

function isMacro(userid,macro) {
	// Simple test for now, this will be upgraded to actually verify if the macro exists
	if (!isValidMacroName(macro)) {
		return false;
	} else if (macro[0] == '~') {
		// Global macro
		var expression = nconfDice.get('global:'+ macro.replace('~',''));
	} else {
		// Personal macro
		if (!userid) {
			return false;
		} else {
			var expression = nconfDice.get('personal:'+ userid +':macros:'+ macro.replace('~',''));
		}
	}
	
	if (expression) {
		return true;
	} else {
		return false;
	}
}

function isValidMacroName(expression) {
	// Macro names can only contains alphanumeric characters, underscores and hyphens.
	if (!expression.match(/^((?:[~]?)(?:[a-z0-9_-]+))$/i)) {
		return false;
	} else {
		return true;
	}
}

function RollDie(sides) {
	sides = parseInt(sides);
	if (!sides) return 0;
	
	return Math.floor(Math.random() * sides) + 1;
}

function saveDiceConfig() {
	nconfDice.save(function(err){
		if (err) {
			console.error(err.message);
			return;
		}
	});
}
