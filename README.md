[![FINOS - Incubating](https://cdn.jsdelivr.net/gh/finos/contrib-toolbox@master/images/badge-incubating.svg)](https://finosfoundation.atlassian.net/wiki/display/FINOS/Incubating)

# Secure Electron Adapter

ChartIQ's Secure Electron Adapter provides an easy way to create an Electron application that adheres to Electron's own security recommendations by design.

## Installation


```sh
npm install secure-electron-adapter --save
```

## Usage example

See the sea-quick-start for example usage.

### To debug:

- Open Chrome and navigate to `chrome://inspect`
- Click "Open Dedicated Devtools for Node"
- Select "Add connection" under the Connection tab
- Enter `localhost:5858` (the port can be found in the sea package.json in the startbrk section under the flag --inspect-brk)
- Under the Sources tab, click on the Node subheading to see the sources list.

## Code Organization
- index.js is the file that will run in the deployed Electron application.
- exports.js is a collection of files that you would traditionally assume is exported by a node module.
- src/Main is code that runs inside of Main process of Electron.
- src/Render is code that runs inside of the browser.

## Contributing

1. Fork it (<https://github.com/finos/secure-electron-adapter/fork>)
2. Create your feature branch (`git checkout -b feature/fooBar`)
3. Read our [contribution guidelines](.github/CONTRIBUTING.md) and [Community Code of Conduct](https://www.finos.org/code-of-conduct)
4. Commit your changes (`git commit -am 'Add some fooBar'`)
5. Push to the branch (`git push origin feature/fooBar`)
6. Create a new Pull Request

_NOTE:_ Commits and pull requests to FINOS repositories will only be accepted from those contributors with an active, executed Individual Contributor License Agreement (ICLA) with FINOS OR who are covered under an existing and active Corporate Contribution License Agreement (CCLA) executed with FINOS. Commits from individuals not covered under an ICLA or CCLA will be flagged and blocked by the FINOS Clabot tool. Please note that some CCLAs require individuals/employees to be explicitly named on the CCLA.

*Need an ICLA? Unsure if you are covered under an existing CCLA? Email [help@finos.org](mailto:help@finos.org)*


## License

Copyright 2018 ChartIQ

Distributed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

SPDX-License-Identifier: [Apache-2.0](https://spdx.org/licenses/Apache-2.0)
