# Overview of e2o webPreferences

### Provide secure settings for all windows created using e2o api

##### a. disable node integration for all windows

The goal is to limit the powers you grant to remote content, thus making it dramatically more difficult for an attacker to harm your users should they gain the ability to execute JavaScript on your website. A cross-site-scripting (XSS) attack is more dangerous if an attacker can jump out of the renderer process and execute code on the user's computer. Cross-site-scripting attacks are fairly common - and while an issue, their power is usually limited to messing with the website that they are executed on. Disabling Node.js integration helps prevent an XSS from being escalated into a so-called "Remote Code Execution" (RCE) attack.

##### b. sandbox is set to true for all windows 

One of the key security features of Chromium is that all blink rendering/JavaScript code is executed within a sandbox. This sandbox uses OS-specific features to ensure that exploits in the renderer process cannot harm the system. Sandbox leverages the OS-provided security to allow code execution that cannot make persistent changes to the computer or access information that is confidential. The architecture and exact assurances that the sandbox provides are dependent on the operating system.

To learn more about the sandbox, view https://electronjs.org/docs/api/sandbox-option and https://chromium.googlesource.com/chromium/src/+/master/docs/design/sandbox.md

##### c. enableRemoteModule is set to false

Prevents the `remote` module from being used in renderer processes. This prevents any symbols from being loaded into the renderer process that live in the main process. Note: This does not prevent the remote module from being used in preloads. For example. `fin.Window.getCurrent()` will still work.

##### d. webSecurity is set to true

Electron is secure by default through a same-origin policy requiring all JavaScript and CSS code to originate from the machine running the Electron application. Setting the webSecurity property of a webPreferences object to false will disable the same-origin policy.