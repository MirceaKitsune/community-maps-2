var g_Amounts = {
	"scarce": 0.2,
	"few": 0.5,
	"normal": 1,
	"many": 1.75,
	"tons": 3
};

var g_Mixes = {
	"same": 0,
	"similar": 0.1,
	"normal": 0.25,
	"varied": 0.5,
	"unique": 0.75
};

var g_Sizes = {
	"tiny": 0.5,
	"small": 0.75,
	"normal": 1,
	"big": 1.25,
	"huge": 1.5,
};

var g_AllAmounts = Object.keys(g_Amounts);
var g_AllMixes = Object.keys(g_Mixes);
var g_AllSizes = Object.keys(g_Sizes);

var g_DefaultTileClasses = [
	"animals",
	"baseResource",
	"berries",
	"bluff",
	"bluffIgnore", // performance improvement
	"dirt",
	"fish",
	"food",
	"forest",
	"hill",
	"land",
	"map",
	"metal",
	"mountain",
	"plateau",
	"player",
	"prop",
	"ramp",
	"rock",
	"settlement",
	"spine",
	"valley",
	"water"
];

var g_TileClasses;

var g_PlayerbaseTypes = {
	"line": {
		"getPosition": (distance, groupedDistance, startAngle) => placeLine(getTeamsArray(), distance, groupedDistance, startAngle),
		"distance": fractionToTiles(randFloat(0.2, 0.35)),
		"groupedDistance": fractionToTiles(randFloat(0.08, 0.1)),
		"walls": false
	},
	"radial": {
		"getPosition": (distance, groupedDistance, startAngle) => playerPlacementCircle(distance, startAngle),
		"distance": fractionToTiles(randFloat(0.25, 0.35)),
		"groupedDistance": fractionToTiles(randFloat(0.08, 0.1)),
		"walls": true
	},
	"randomGroup": {
		"getPosition": (distance, groupedDistance, startAngle) => playerPlacementRandom(sortAllPlayers()) || playerPlacementCircle(distance, startAngle),
		"distance": fractionToTiles(randFloat(0.25, 0.35)),
		"groupedDistance": fractionToTiles(randFloat(0.08, 0.1)),
		"walls": true
	},
	"stronghold": {
		"getPosition": (distance, groupedDistance, startAngle) => placeStronghold(getTeamsArray(), distance, groupedDistance, startAngle),
		"distance": fractionToTiles(randFloat(0.2, 0.35)),
		"groupedDistance": fractionToTiles(randFloat(0.08, 0.1)),
		"walls": false
	},
	"besideAllies": {
		"getPosition": (distance, groupedDistance, startAngle) => playerPlacementMultiArcs(sortAllPlayers(), distance, startAngle),
		"distance": fractionToTiles(randFloat(0.3, 0.35)),
		"groupedDistance": null, // The gap between allies is computed within the function
		"walls": false
	}
};

/**
 * Adds an array of elements to the map.
 */
function addElements(elements)
{
	for (let element of elements)
		element.func(
			[
				avoidClasses.apply(null, element.avoid),
				stayClasses.apply(null, element.stay || null)
			],
			pickSize(element.sizes),
			pickMix(element.mixes),
			pickAmount(element.amounts),
			element.baseHeight || 0);
}

/**
 * Converts "amount" terms to numbers.
 */
function pickAmount(amounts)
{
	let amount = pickRandom(amounts);

	if (amount in g_Amounts)
		return g_Amounts[amount];

	return g_Amounts.normal;
}

/**
 * Converts "mix" terms to numbers.
 */
function pickMix(mixes)
{
	let mix = pickRandom(mixes);

	if (mix in g_Mixes)
		return g_Mixes[mix];

	return g_Mixes.normal;
}

/**
 * Converts "size" terms to numbers.
 */
function pickSize(sizes)
{
	let size = pickRandom(sizes);

	if (size in g_Sizes)
		return g_Sizes[size];

	return g_Sizes.normal;
}

/**
 * Choose starting locations for all players.
 *
 * @param {string} type - "radial", "line", "stronghold", "randomGroup"
 * @param {number} distance - radial distance from the center of the map
 * @param {number} groupedDistance - space between players within a team
 * @param {number} startAngle - determined by the map that might want to place something between players
 * @param {function} createBaseFunc - function to create a base for a single player (optional).
 * @returns {Array|undefined} - If successful, each element is an object that contains id, angle, x, z for each player
 */
function createBasesByPattern(type, distance, groupedDistance, startAngle, createBasesFunc=createBases)
{
	let [playerIDs, playerPosition, playerAngle] = g_PlayerbaseTypes[type].getPosition(distance, groupedDistance, startAngle);
	let playerPosData = createBasesFunc(playerIDs, playerPosition, g_PlayerbaseTypes[type].walls);
	playerPosData.push(playerAngle);
	return playerPosData;
}

function createBases(playerIDs, playerPosition, walls)
{
	for (let i = 0; i < getNumPlayers(); ++i)
		createBase(playerIDs[i], playerPosition[i], walls);

	return [playerIDs, playerPosition];
}

/**
 * Create the base for a single player.
 *
 * @param {Object} player - contains id, angle, x, z
 * @param {boolean} walls - Whether or not iberian gets starting walls
 */
function createBase(playerID, playerPosition, walls)
{
	placePlayerBase({
		"playerID": playerID,
		"playerPosition": playerPosition,
		"PlayerTileClass": g_TileClasses.player,
		"BaseResourceClass": g_TileClasses.baseResource,
		"baseResourceConstraint": avoidClasses(g_TileClasses.water, 0, g_TileClasses.mountain, 0),
		"Walls": g_Map.getSize() > 192 && walls,
		"CityPatch": {
			"outerTerrain": g_Terrains.roadWild,
			"innerTerrain": g_Terrains.road,
			"painters": [
				new TileClassPainter(g_TileClasses.player)
			]
		},
		"Chicken": {
			"template": g_Gaia.chicken
		},
		"Berries": {
			"template": g_Gaia.fruitBush
		},
		"Mines": {
			"types": [
				{ "template": g_Gaia.metalLarge },
				{ "template": g_Gaia.stoneLarge }
			]
		},
		"Trees": {
			"template": g_Gaia.tree1,
			"count": currentBiome() == "generic/savanna" ? 5 : 15
		},
		"Decoratives": {
			"template": g_Decoratives.grassShort
		}
	});
}

/**
 * Return an array where each element is an array of playerIndices of a team.
 */
function getTeamsArray()
{
	var playerIDs = sortAllPlayers();
	var numPlayers = getNumPlayers();

	// Group players by team
	var teams = [];
	for (let i = 0; i < numPlayers; ++i)
	{
		let team = getPlayerTeam(playerIDs[i]);
		if (team == -1)
			continue;

		if (!teams[team])
			teams[team] = [];

		teams[team].push(playerIDs[i]);
	}

	// Players without a team get a custom index
	for (let i = 0; i < numPlayers; ++i)
		if (getPlayerTeam(playerIDs[i]) == -1)
			teams.push([playerIDs[i]]);

	// Remove unused indices
	return teams.filter(team => true);
}

/**
 * Place teams in a line-pattern.
 *
 * @param {Array} playerIDs - typically randomized indices of players of a single team
 * @param {number} distance - radial distance from the center of the map
 * @param {number} groupedDistance - distance between players
 * @param {number} startAngle - determined by the map that might want to place something between players.
 *
 * @returns {Array} - contains id, angle, x, z for every player
 */
function placeLine(teamsArray, distance, groupedDistance, startAngle)
{
	let playerIDs = [];
	let playerPosition = [];

	let mapCenter = g_Map.getCenter();
	let dist = fractionToTiles(0.45);

	for (let i = 0; i < teamsArray.length; ++i)
	{
		var safeDist = distance;
		if (distance + teamsArray[i].length * groupedDistance > dist)
			safeDist = dist - teamsArray[i].length * groupedDistance;

		var teamAngle = startAngle + (i + 1) * 2 * Math.PI / teamsArray.length;

		for (let p = 0; p < teamsArray[i].length; ++p)
		{
			playerIDs.push(teamsArray[i][p]);
			playerPosition.push(Vector2D.add(mapCenter, new Vector2D(safeDist + p * groupedDistance, 0).rotate(-teamAngle)).round());
		}
	}

	return [playerIDs, playerPosition];
}

/**
 * Place given players in a stronghold-pattern.
 *
 * @param teamsArray - each item is an array of playerIDs placed per stronghold
 * @param distance - radial distance from the center of the map
 * @param groupedDistance - distance between neighboring players
 * @param {number} startAngle - determined by the map that might want to place something between players
 */
function placeStronghold(teamsArray, distance, groupedDistance, startAngle)
{
	var mapCenter = g_Map.getCenter();

	let playerIDs = [];
	let playerPosition = [];

	for (let i = 0; i < teamsArray.length; ++i)
	{
		var teamAngle = startAngle + (i + 1) * 2 * Math.PI / teamsArray.length;
		var teamPosition = Vector2D.add(mapCenter, new Vector2D(distance, 0).rotate(-teamAngle));
		var teamGroupDistance = groupedDistance;

		// If we have a team of above average size, make sure they're spread out
		if (teamsArray[i].length > 4)
			teamGroupDistance = Math.max(fractionToTiles(0.08), groupedDistance);

		// If we have a solo player, place them on the center of the team's location
		if (teamsArray[i].length == 1)
			teamGroupDistance = fractionToTiles(0);

		// TODO: Ensure players are not placed outside of the map area, similar to placeLine

		// Create player base
		for (var p = 0; p < teamsArray[i].length; ++p)
		{
			var angle = startAngle + (p + 1) * 2 * Math.PI / teamsArray[i].length;
			playerIDs.push(teamsArray[i][p]);
			playerPosition.push(Vector2D.add(teamPosition, new Vector2D(teamGroupDistance, 0).rotate(-angle)).round());
		}
	}

	return [playerIDs, playerPosition];
}

/**
 * Place on an arc on a circle, 1 arc per team. Each team member is on the same arc.
 * @param {Array[int]} playerIDs
 * @param {float} radius
 * @param {float} mapAngle
 * @param {float} teamGapRatio Ratio difference between team gap and players on the same team Should be 0 to 1.
 * e.g. 0.8 means the ratio team gap:team player gap is 8:2. n.b. < 0.5 means enemies are closer
 * than team members are to each other
 */
function playerPlacementMultiArcs(playerIDs, radius, mapAngle, teamGapFrac) {
	var mapCenter = g_Map.getCenter();
	let playerTeams = playerIDs.map(getPlayerTeam);
	let uniqueTeams = new Set(playerTeams);
	let nTeams = uniqueTeams.size;
	let nPlayers = playerIDs.length;

	let teamIntMap = {};
	let teamFreqPlayers = {};
	let teamPlayersIntMap = {};

	// Shuffle team order.
	let teamShuffle = function(length) {
		let i = 0;
		let array = Array.from(Array(length), () => i++);
			for(let i = array.length - 1; i > 0; i--){
		  	const j = Math.round(Math.random() * (array.length-1))
		  	const temp = array[i]
		  	array[i] = array[j]
		  	array[j] = temp
		}
		return array;
	}(nTeams);

	// Team to array (random) index map.
	Array.from(uniqueTeams).map((val, i) => {teamIntMap[val] = teamShuffle[i];});
	// Player frequency in teams.
	playerTeams.map((v) => teamFreqPlayers[v] ? teamFreqPlayers[v] += 1 : teamFreqPlayers[v] = 1);
	// Team player int map. This is useful when positioning players on a team.
	Array.from(uniqueTeams).map((val) => {teamPlayersIntMap[val] = 0;});

	// I don't know at this point. Trust my brain. It's smarter than my brain.
	// Something-something add the previous team player combos.
	// It's some kind of "cumulative frequency" of player teams idk.
	for (let key in teamPlayersIntMap) {
		if (teamPlayersIntMap.hasOwnProperty(key)) {
			for (let key2 in teamPlayersIntMap) {
				if (teamPlayersIntMap.hasOwnProperty(key)) {
					if (teamIntMap[key2] > teamIntMap[key]) {
						teamPlayersIntMap[key2] += teamFreqPlayers[key]-1;
					}
				}
			}
		}
	}

	const teamPlayerGapFrac = 1 - teamGapFrac;

	const totalGapCount = teamGapFrac*nTeams + teamPlayerGapFrac*(nPlayers-nTeams);

	const teamGapAngle = 2*Math.PI*teamGapFrac/totalGapCount;
	const teamPlayerGapAngle = 2*Math.PI*teamPlayerGapFrac/totalGapCount;


	function playerAngle(i) {

		return mapAngle + teamGapAngle*teamIntMap[playerTeams[i]] + teamPlayerGapAngle*((teamPlayersIntMap[playerTeams[i]]++));
	}

	return playerPlacementCustomAngle(
		radius,
		mapCenter,
		playerAngle);
}

/**
 * Creates tileClass for the default classes and every class given.
 *
 * @param {Array} newClasses
 * @returns {Object} - maps from classname to ID
 */
function initTileClasses(newClasses)
{
	var classNames = g_DefaultTileClasses;

	if (newClasses)
		classNames = classNames.concat(newClasses);

	g_TileClasses = {};
	for (var className of classNames)
		g_TileClasses[className] = g_Map.createTileClass();
}

// replaces code on Mainland-type maps to generate both hills and mountains,
// rather than what's used on vanilla mainland (using randbool to decide
// one or the other)
function createHillsAndMountains (hillCount, mountainCount)
{
	createHills([tCliff, tCliff, tHill],
			avoidClasses(clPlayer, 20, clHill, 15, clCliff, 5),
			clHill,
			hillCount / 2),
	createMountains(tCliff,
		avoidClasses(clPlayer, 20, clHill, 15, clCliff, 5),
		clHill,
		//scaleByMapSize(3, 15)); // count
		mountainCount / 2)
}
