// FINOS project blueprint setup for Docusaurus 1.x project documentation websites
// 
// Check comments below to know how to adapt the default configuration to your FINOS project.
// If a configuration is not commented, please do not change it.
//
// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.

const users = require('./data/users.json');

const siteConfig = {
  // GitHub repository coordinates
  // Change the following items replacing 'project-blueprint' with your repository name
  title: 'Secure Electron Adapter', // Title for your website.
  tagline: 'Secure Electron Adapter',
  cname: 'sea.finos.org',
  url: 'https://finos.github.io/secure-electron-adapter',
  baseUrl: '/',
  projectName: 'secure-electron-adapter',
  repoUrl: 'https://github.com/finos/secure-electron-adapter',
  organizationName: 'FINOS',

  // Header menu
  // We suggest that Docs, Roadmap, Team and GitHub items are available
  headerLinks: [
//     {doc: '', label: 'Docs'},
//     {doc: '', label: 'Roadmap'},
//     {doc: '', label: 'Team'},
    {href: 'https://github.com/finos/secure-electron-adapter', label: 'GitHub'},
    {blog: false}
  ],
  users,

  // Update icon files with program/project logos
  headerIcon: 'img/favicon/favicon-finos.ico',   
  footerIcon: 'img/favicon/favicon-finos.ico',
  favicon: 'img/favicon/favicon-finos.ico',

  colors: {
    primaryColor: '#0086bf',
    secondaryColor: '#0033A0'
  },

  // Change the copyright info with correct program/project names */
  copyright: `Copyright © ${new Date().getFullYear()} Secure Electron Adapter - FINOS`,

  highlight: {
    theme: 'default',
  },

  scripts: ['https://buttons.github.io/buttons.js'],
  onPageNav: 'separate',
  cleanUrl: true,

  // Update Open Graph and Twitter cards/links, if project have dedicated ones
  ogImage: 'img/undraw_online.svg',
  twitterImage: 'img/undraw_tweetstorm.svg',
  twitterUsername: 'FinosFoundation'
};

module.exports = siteConfig;
