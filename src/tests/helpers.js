/**
 * Creates a test object to mimic structure from permissions list
 * Takes an array of categories and an array of function names with function names divided equally by categories
 * If the number of names doesn't map equally to the number of categories then more names will be placed in the first category
 * Each function is a assigned a state based on an overall state passed in:
 *
 * States:
 * true: returns true
 * false: returns false
 * alternate_true: Alternates between true and false
 * alternate_false: Alternates between false and true
 * junk: Used to test bad values, currently returns the value of i
 * specify: Use this state to specify a boolean for every name. Requires the optional parameter values to contain an array of bools of the same length as the array of names.
 * @param {Object[]} categoryArray
 * @param {Object[]} nameArray
 * @param {string} state
 * @param {*} values //optional: used only if state="specify"
 */
function createPermissionObject(categoryArray, nameArray, state, values = null) {
	// Determines how many items in the name array to iterate over.
	const quotient = Math.floor(nameArray.length / categoryArray.length);
	const remainder = (nameArray.length % categoryArray.length);
	// Empty objects to fill to create a nested object. innerObj will be redefined for every category
	const outerObj = {};
	let innerObj;
	let start = 0;
	let specifyValue;


	// Iterate over the categories to create outer objects
	for (let i = 0; i < categoryArray.length; i++) {
		innerObj = {};

		// Handle an array of names that does not evenly divide between categories, with more names going in the first category
		if (i === 0) {
			namesPerCategory = quotient + remainder;
		} else {
			namesPerCategory = quotient + namesPerCategory;
		}

		// Create an object and populate it with part of the names array
		for (let j = start; j < namesPerCategory; j++) {
			specifyValue = null;
			if (values && values[j] !== undefined) {
				specifyValue = values[j];
			}
			// set each method to a state, usually a boolean
			const currentState = getState(state, j, specifyValue);
			innerObj[nameArray[j]] = currentState;
		}
		// After completing the inner object add it to the category
		outerObj[categoryArray[i]] = innerObj;
		// set start to namesPerCategory position as we move through the name array
		start = namesPerCategory;
	}
	return outerObj;
}

/**
 * Add options to the specified category an existing object
 * @param {Object} obj
 * @param {string} category
 * @param {Object} optionsValues // format {'preload': true}
 */
function addOptionsToPermission(obj, category, optionsValues) {
	if (obj[category]) {
		obj[category].webPreferences = optionsValues;
	}
}

/**
 * Helper function for createPermissionObject
 * Expected to be called while iterating list of names for each category
 * Returns a value based on the state and the value of i
 *
 * States:
 * true: returns true
 * false: returns false
 * alternate_true: Alternates between true and false starting with true on even numbers of i
 * alternate_false: Alternates between true and false starting with false on even numbers of i
 * junk: Used to test bad values, currently returns the value of i
 * specify: Returns boolean passed in
 * @param {string} state
 * @param {integer} i
 * @param {*} value //optional, boolean to set when state is specify
 */
function getState(state, i, value = null) {
	// console.log('state', state);
	let finalState;
	switch (state) {
	case 'alternate_true':
		finalState = !((i % 2));
		break;
	case 'alternate_false':
		finalState = !!((i % 2));
		break;
	case 'specify':
		if (value === null) { console.error('Error: Value missing when state is specify', i); }
		finalState = value;
		break;
	case 'junk':
		finalState = i;
		break;
	case 'false':
		finalState = false;
		break;
	case 'true':
	default:
		finalState = true;
	}
	return finalState;
}

module.exports = {
	createPermissionObject,
	addOptionsToPermission
};
