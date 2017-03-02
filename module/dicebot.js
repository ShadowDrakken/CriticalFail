var scriptName = Path.basename(__filename);
registerCommand(scriptName, 'roll', Context.task, doRoll);

function doRoll(message,param){
	var expression = param.join(' ');
	var comment = '';
	if (expression.match(',') > 1) return;
	
	// separate out the comment in advance
	if (expression.match(/[:]/g)) {
		comment = expression.split(':')[1].replace(/\s+$|^\s+/,'');
		expression = expression.split(':')[0].toLowerCase();
	}
	expression = expression.replace(/ /g, '');

	// Validate the input is a valid dice roll with valid expressions
	var validated = expression.match(/^((?:\d+[d]\d+)(?:(?:[+]|[-])\d+){0,1})((?:(?:(?:(?:[xelts])|(?:[k][-]{0,1}))\d+)*))/i);
	if (!validated) {
		const msgEmbed = new Discord.RichEmbed()
				.setTitle(message.author.username)
				.addField('Error', 'Invalid expression.')
				
		if (comment) msgEmbed.setDescription(comment);

		message.channel.sendEmbed(msgEmbed, '', { disableEveryone: true }).catch(console.error);
		return;
	}
	
	// Split the dice portion of the expression into dice, sides and modifier
	var expDice = validated[1].match(/(\d+)[d](\d+)((?:[+]|[-])\d+){0,1}/i);
	
	// Separate and split the expressions, allowing for optional spacing for compactness vs readability
	var expMods = validated[2] ? validated[2].replace(/[xelkts]/gi,' $&').replace(/^\s+/,'').split(' ') : [];
		
	// Validate number of dice and dice sides
	if (expDice[1] > 50 || expDice[2] > 100) {
		const msgEmbed = new Discord.RichEmbed()
				.setTitle(message.author.username)
				.addField('Error', 'Too many dice or dice sides.')
				
		if (comment) msgEmbed.setDescription(comment);

		message.channel.sendEmbed(msgEmbed, '', { disableEveryone: true }).catch(console.error);
		return;
	}

	var repeats = 1;
	var explosion = undefined;
	var explosionLimit = undefined;
	var keeps = undefined;
	var target = undefined;
	var successive = undefined;

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
		for (var x=0; x < parseInt(expDice[1]); x++) {
			if (!explosion) {
				var d = thisRoller()
				var diceSum = d + (expDice[3] ? parseInt(expDice[3]) : 0);
				diceRolls.push({dice:[d], dropped:[], sum:diceSum, successes:countSuccesses(d)});
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
				diceSum = diceSet.reduce(function(a,b) {return a + b;}, 0) + (expDice[3] ? parseInt(expDice[3]) : 0);
				diceRolls.push({dice:diceSet, dropped:[], sum:diceSum, successes:countSuccesses(diceSum)});
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
		
		if (target) {
			total = diceRolls.reduce(function(a,b) {return a + b.successes}, 0);
		} else {
			total = diceRolls.reduce(function(a,b) {return a + b.sum}, 0);
		}
		RollSets.push(('`'+ validated[1] + '`=`'+ outRolls +'`'+ outDropped +'=`'+ total +'`').trim());
	}
	
	msgText = RollSets.join("\r\n");
	
	const msgEmbed = new Discord.RichEmbed()
		.setTitle(message.author.username)
		.addField('Rolling', expression, true)
		//.setThumbnail(client.user.avatarURL)
		.addField('Result', msgText, true);
		
		if (comment) msgEmbed.setDescription(comment);
	
	message.channel.sendEmbed(msgEmbed, '', { disableEveryone: true }).catch(console.error);
}

/* Complex dice example
4d6+2k3e6l1t4s4x6:Comment
4d6+2 K3 E6L1 T4S4 X6 :Comment

4d6 - roll a d6 four times, modify the pool by the keeps, then total the remaining pool
+2 - add 2 to the total roll after applying keeps and explodes, but before applying successes; can also use -2 for subtraction

K3 - keep the highest 3 die; can also use K-3 to keep the lowest 3
E6 - explode the dice on anything 6 or higher
  L1 - limit explosions to 1 iteration, leave off for unlimited explosions
T4 - count the number of successes that meet the target value 4+
  S4 - count additional successes every 4 past the target
X6 - roll a new set and present results 4 times

:Comment - display the comment with the returned results

No expression may be used more than once
Spaces between expressions are optional
Expressions can occur in any order, with the exception of the dice expression which must
	be at the beginning and :comments which must occur at the end of the expression
Expressions are case-insensitive
*/

function RollDie(sides) {
	sides = parseInt(sides);
	if (!sides) return 0;
	
	return Math.floor(Math.random() * sides) + 1;
}