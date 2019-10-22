const Joi = require('joi');

module.exports = Joi.object().keys({
	dir: Joi.string().required().description('The source directory.'),
	tmpdir: Joi.string().allow(null).description('The base directory to use as a temp directory. Set to false to disable use of a temporary directory.'),
	appCopyright: Joi.string().description('The human-readable copyright line for the app. Maps to the LegalCopyright metadata property on Windows, and NSHumanReadableCopyright on OS X.'),
	appVersion: Joi.string().description('The release version of the application. By default the version property in the package.json is used but it can be overridden with this argument. If neither are provided, the version of Electron will be used. Maps to the ProductVersion metadata property on Windows, and CFBundleShortVersionString on OS X.'),
	appBundleId: Joi.string().description("The bundle identifier to use in the application's plist."),
	appCategoryType: Joi.string().allow(null).description('The application category type, as shown in the Finder via View → Arrange by Application Category when viewing the Applications directory.'),
	asar: [Joi.boolean(), Joi.object().keys({
		ordering: Joi.string().description('A path to an ordering file for packing files. An explanation can be found on the Atom issue tracker.'),
		unpack: Joi.string().description('A glob expression, when specified, unpacks the file with matching names to the app.asar.unpacked directory.'),
		unpackDir: Joi.string().description('Unpacks the dir to the app.asar.unpacked directory whose names exactly or pattern match this string. The asar.unpackDir is relative to dir.')
	}).description('When the value is true, pass default configuration to the asar module.')],
	buildVersion: Joi.string().description('The build version of the application. Defaults to the value of appVersion. Maps to the FileVersion metadata property on Windows, and CFBundleVersion on OS X.'),
	derefSymlinks: Joi.boolean().description('Whether symlinks should be dereferenced during the copying of the application source.'),
	download: Joi.object().keys({
		cache: Joi.string().description('The directory where prebuilt, pre-packaged Electron downloads are cached.'),
		mirrow: Joi.string().description('The URL to override the default Electron download location.'),
		quiet: Joi.string().description('Whether to show a progress bar when downloading Electron.'),
		strictSSL: Joi.boolean().description('Whether SSL certificates are required to be valid when downloading Electron.')
	}).description('If present, passes custom options to electron-download (see the link for more detailed option descriptions and the defaults). Supported parameters include, but are not limited to:'),
	electronVersion: Joi.string().description("The Electron version with which the app is built (without the leading 'v') - for example, 1.4.13. See Electron releases for valid versions. If omitted, it will use the version of the nearest local installation of electron, electron-prebuilt-compile, or electron-prebuilt, defined in package.json in either dependencies or devDependencies."),
	darwinDarkModeSupport: Joi.boolean().description("Forces support for Mojave (macOS 10.14) dark mode in your packaged app. This sets the NSRequiresAquaSystemAppearance key to false in your app's Info.plist. For more information, see the Apple developer documentation."),
	extraResource: [Joi.string(), Joi.array().items(Joi.string()).description("One or more files to be copied directly into the app's Contents/Resources directory for OS X target platforms, and the resources directory for other target platforms.")],
	executableName: Joi.string().description('The name of the executable file (sans file extension). Defaults to the value for the name parameter. For darwin or mas target platforms, this does not affect the name of the .app folder - this will use name parameter.'),
	extendInfo: [Joi.string().allow(null), Joi.object().description("When the value is a String, the filename of a plist file. Its contents are added to the app's plist. When the value is an Object, an already-parsed plist data structure that is merged into the app's plist.")],
	protocols: Joi.array().items(Joi.object().keys({
		name: Joi.string().description('The descriptive name. Maps to the CFBundleURLName metadata property.'),
		schemas: Joi.array().description('One or more protocol schemes associated with the app. For example, specifying myapp would cause URLs such as myapp://path to be opened with the app. Maps to the CFBundleURLSchemes metadata property.')
	})).description('One or more URL protocols associated with the Electron app.'),
	platform: Joi.string().valid('linux', 'win32', 'darwin', 'mas', 'all').description('Allowed values: linux, win32, darwin, mas, all'),
	arch: Joi.string().valid('ia32', 'x64', 'armv7l', 'arm64', 'mips64el', 'all').description('Allowed values: ia32, x64, armv7l, arm64 (Electron 1.8.0 and above), mips64el (Electron 1.8.2-beta.5 to 1.8.8), all'),
	name: Joi.string().allow(null).description('The application name. If omitted, it will use the productName or name value from the nearest package.json.'),
	icon: Joi.string().allow(null).description('The local path to the icon file, if the target platform supports setting embedding an icon. Must be an ico'),
	helperBundleId: Joi.string().description("The bundle identifier to use in the application helper's plist."),
	osxNotarize: Joi.object().keys({
		appleId: Joi.string().description('Your Apple ID username / email'),
		appleIdPassword: Joi.string().description(' The password for your Apple ID, can be a keychain reference')
	}).description('If present, notarizes OS X target apps when the host platform is OS X and XCode is installed. The configuration values listed below can be customized. See electron-notarize for more detailed option descriptions and how to use appleIdPassword safely.'),
	osxSign: [Joi.boolean().valid(true), Joi.object().keys({
		identity: Joi.string().description('The identity used when signing the package via codesign.'),
		entitlements: Joi.string().description(" The path to the 'parent' entitlements."),
		'entitlements-inherit': Joi.string().description("The path to the 'child' entitlements.")
	}).description(' present, signs OS X target apps when the host platform is OS X and XCode is installed. When the value is true, pass default configuration to the signing module. The configuration values listed below can be customized when the value is an Object. See electron-osx-sign for more detailed option descriptions and the defaults.')],
	win32metadata: Joi.object().keys({
		CompanyName: Joi.string().description('(defaults to author name from the nearest package.json)'),
		FileDescription: Joi.string().description('(defaults to either productName or name from the nearest package.json)'),
		OriginalFilename: Joi.string().description('(defaults to renamed .exe file)'),
		ProductName: Joi.string().description('(defaults to either productName or name from the nearest package.json)'),
		InternalName: Joi.string().description('(defaults to either productName or name from the nearest package.json)'),
		'requested-execution-level': Joi.string().allow(null).description('For more information, see the node-rcedit module.'), // https://github.com/electron/node-rcedit
		'application-manifest': Joi.string().allow(null).description('For more information, see the node-rcedit module.')//
	}).description('Object (also known as a "hash") of application metadata to embed into the executable'),
	prebuiltAsar: Joi.string().description('The path to a prebuilt ASAR file.'),
	prune: Joi.boolean().description('Walks the node_modules dependency tree to remove all of the packages specified in the devDependencies section of package.json from the outputted Electron app.'),
	overwrite: Joi.boolean().description('Whether to replace an already existing output directory for a given platform (true) or skip recreating it (false).'),
	ignore: Joi.array().items(Joi.string()).description('One or more additional regular expression patterns which specify which files to ignore when copying files to create the app bundle(s). The regular expressions are matched against the absolute path of a given file/directory to be copied.'),
	out: Joi.string().description('The base directory where the finished package(s) are created.'),
	quiet: Joi.boolean().description('If true, disables printing informational and warning messages to the console when packaging the application. This does not disable errors.'),
	afterCopy: Joi.array().items(
		Joi.func()
	).description('An array of functions to be called after your app directory has been copied to a temporary directory. Each function is called with five parameters:')
		.notes(['buildPath (String): The path to the temporary folder where your app has been copied to',
			'electronVersion (String): The version of electron you are packaging for',
			'platform (String): The target platform you are packaging for',
			'arch (String): The target architecture you are packaging for',
			'callback (Function): Must be called once you have completed your actions',
			'afterCopy will not be called if prebuiltAsar is set.'
		]),
	afterExtract: Joi.array().items(
		Joi.func()
	).description('An array of functions to be called after Electron has been extracted to a temporary directory. Each function is called with five parameters:')
		.notes(['buildPath (String): The path to the temporary folder where your app has been copied to',
			'electronVersion (String): The version of electron you are packaging for',
			'platform (String): The target platform you are packaging for',
			'arch (String): The target architecture you are packaging for',
			'callback (Function): Must be called once you have completed your actions'
		]),
	afterPrune: Joi.array().items(
		Joi.func()
	).description('An array of functions to be called after the prune command has been run in the temporary directory. Each function is called with five parameters:')
		.notes(['buildPath (String): The path to the temporary folder where your app has been copied to',
			'electronVersion (String): The version of electron you are packaging for',
			'platform (String): The target platform you are packaging for',
			'arch (String): The target architecture you are packaging for',
			'callback (Function): Must be called once you have completed your actions',
			'None of these functions will be called if the prune option is false or prebuiltAsar is set.'
		]),
	all: Joi.boolean().description('When true, sets both arch and platform to all.')

});
