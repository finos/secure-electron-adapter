/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

const CompLibrary = require('../../core/CompLibrary.js');
const Showcase = require(`${process.cwd()}/core/Showcase.js`);

const MarkdownBlock = CompLibrary.MarkdownBlock; /* Used to read markdown */
const Container = CompLibrary.Container;
const GridBlock = CompLibrary.GridBlock;

class HomeSplash extends React.Component {
  render() {
    const {siteConfig, language = ''} = this.props;
    const {baseUrl, docsUrl} = siteConfig;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    const langPart = `${language ? `${language}/` : ''}`;

    const SplashContainer = props => (
      <div className="homeContainer">
        <div className="homeSplashFade">
          <div className="wrapper homeWrapper">{props.children}</div>
        </div>
      </div>
    );

    const Logo = props => (
      <div className="projectLogo">
        <img src={props.img_src} alt="Project Logo" />
      </div>
    );

    const ProjectTitle = props => (
      <h2 className="projectTitle">
        {props.title}
        <small>{props.tagline}</small>
      </h2>
    );

    const PromoSection = props => (
      <div className="section promoSection">
        <div className="promoRow">
          <div className="pluginRowBlock">{props.children}</div>
        </div>
      </div>
    );

    const Button = props => (
      <div className="pluginWrapper buttonWrapper">
        <a className="button" href={props.href} target={props.target}>
          {props.children}
        </a>
      </div>
    );

    return (
      <SplashContainer>
        <div className="inner">
          <ProjectTitle tagline={siteConfig.tagline} title={siteConfig.title} />
          <PromoSection>
            <Button href=''>Get Started</Button>
            <Button href={siteConfig.repoUrl}>GitHub</Button>
          </PromoSection>
        </div>
      </SplashContainer>
    );
  }
}

class Index extends React.Component {
  render() {
    const {config: siteConfig, language = ''} = this.props;
    const {docsUrl, baseUrl, defaultVersionShown} = siteConfig;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    const langPart = `${language ? `${language}/` : ''}`;
    const versionPart = `${defaultVersionShown ? `${defaultVersionShown}/` : ''}`;
    const docUrl = doc => `${docsPart}${versionPart}${langPart}${doc}`;


    const Block = props => (
      <Container
        padding={['bottom', 'top']}
        id={props.id}
        background={props.background}>
        <GridBlock
          align="center"
          contents={props.children}
          layout={props.layout}
        />
      </Container>
    );

    const FeatureCallout = () => (
      <div  className="featureShowcaseSection  paddingBottom" style={{textAlign: 'center'}}>
        <h2>Use Cases</h2>
        <MarkdownBlock>{`Document business [use cases](${docUrl('use-cases/overview')}) that drives the Project Blueprint.`}</MarkdownBlock>
      </div>
    );

    const Description = () => (
      <div>
        <h2>Quick Start Guide</h2>
        <p>
          Please see the <a href="https://github.com/finos/sea-quick-start">sea-quick-start</a> repository on GitHub for example usage.
        </p>
        <h2>Business Problem</h2>
        <p>
          The Secure Electron Adapter (SEA) targets the need for a completely open source means of developing secure, 
          enterprise-class desktop applications. This technology is the means to host Web technology based (HTML5) applications 
          directly on a computer desktop (versus within a consumer Web browser like Chrome or Edge). Specifically, this 
          contribution offers a means to use Electron in a secured manner, making its use appropriate for the financial 
          institution. 
        </p>
        <h2>Solution</h2>
        <p>
          SEA provides a secure alternative to working directly with the Electron API. It acts as a firewall, 
          intermediating API calls within a permission structure that obviates the risk of running third party 
          content in a desktop agent.
        </p>
        <p>It is pure open source, requiring no commercial software, relying exclusively on Electron.</p>
        <p>
          The contribution has been assessed by a third party to be secure and of appropriate architecture to address security 
          considerations generally. In addition to our own work designing a secured Electron, we have implemented 
          or provided vetted, alternative approaches to all recommendations for security provided by the Electron community.
        </p>
        <p>
          Architecturally, SEA is a JavaScript adapter, giving access to Electron window-manipulation and OS capabilities, 
          via a disintermediation of the actual Electron APIs for security reasons. Access to the Node main process is 
          restricted and security profiles have been provided and configured according to recommended practice. 
          The framework provides an inter-application communication facility hosted from within the Electron main process.
        </p>
        <h2>Current State</h2>
        <p>
          SEA is currently a part of ChartIQ's commercial Finsemble offering. It was developed in 2018 and early 2019 as part of 
          Finsemble's migration to run more purely on standard Electron capability. This is a production offering and the basis 
          of current Finsemble client installations. It is our actively maintained product capability and we intend to continue
          evolving and maintaining it as such. It is currently not completely isolated in a form we can contribute. 
        </p>
      </div>
    );

    const Features = () => (
      <Block background="white" layout="fourColumn">
        {[
          {
            content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Pellentesque]() pellentesque id standard`,
            image: `${baseUrl}img/feature-blank.svg`,
            imageAlign: 'top',
            title: 'Example 1',
          },
          {
            content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Pellentesque]() pellentesque id standard`,
            image: `${baseUrl}img/feature-blank.svg`,
            imageAlign: 'top',
            title: 'Example 2',
          },
          {
            content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Pellentesque]() pellentesque id standard`,
            image: `${baseUrl}img/feature-blank.svg`,
            imageAlign: 'top',
            title: 'Example 3',
          },
          {
            content: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. [Pellentesque]() pellentesque id standard`,
            image: `${baseUrl}img/feature-blank.svg`,
            imageAlign: 'top',
            title: 'Example 4',
            link: `${baseUrl}/appd-intro`
          }
          
        ]}
      </Block>
    );

    const UserShowcase = () => {
      if ((siteConfig.users || []).length === 0) {
        return null;
      }

      const pinnedUsers = siteConfig.users.filter(user => user.pinned);

      const pageUrl = page => baseUrl + (language ? `${language}/` : '') + page;

      return (
        <div className="userShowcase productShowcaseSection paddingTop paddingBottom">
          <h2>Who is Using Secure Electron Adapter?</h2>
          <p>ChartIQ developed the Secure Electron Adapter to make developing applications on top of Electron easy and secure</p>
          <Showcase users={pinnedUsers} />
          {/* exclude button to users page for now, all users shown on main page */}
          {/* <div className="more-users">
            <a className="button" href={pageUrl('users.html')}>
              All {siteConfig.title} Users
            </a>
          </div> */}
        </div>
      );
    };

    return (
      <div>
        <HomeSplash siteConfig={siteConfig} language={language} />
        <div className="mainContainer">
          {/* <Features /> */}
          <Description />
          {/* <FeatureCallout /> */}
          <UserShowcase />
        </div>
      </div>
    );
  }
}

module.exports = Index;