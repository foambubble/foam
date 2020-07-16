# Capture Notes With Drafts Pro

## Context

* You use [Foam for VSCode](https://marketplace.visualstudio.com/items?itemName=foam.foam-vscode) to manage your notes
* You wish to adopt a practice such as [A writing inbox for transient and incomplete notes](https://notes.andymatuschak.org/A%20writing%20inbox%20for%20transient%20and%20incomplete%20notes)
* You wish to use [Drafts Pro](https://docs.getdrafts.com/) to capture quick notes into your Foam notes from your iOS device

## Required Extensions

* [Foam for VSCode](https://marketplace.visualstudio.com/items?itemName=foam.foam-vscode)

## Other tools

* We assume you are familiar with how to use GitHub (if you are using Foam this is implicit)
* You have an iOS device with [Drafts](https://getdrafts.com/)
* You have upgraded to [Drafts Pro](https://docs.getdrafts.com/draftspro) (needed to edit actions).

## Instructions

1. [Create a new action in Drafts](https://docs.getdrafts.com/docs/actions/editing-actions)
2. Add a single [step](https://docs.getdrafts.com/actions/steps/) of type Script
3. Edit the script adding the code from the block below
4. Edit settings at the top of the script to suit your preferences
5. Set other Action options in Drafts as you wish
6. Save the Action
7. In GitHub [create a Personal Access Token](https://github.com/settings/tokens) and give it `repo` scope - make a note of the token
8. In Drafts create a note
9. Select the action you created in steps 1-6
10. On the first run you will need to add the following information:
    1. your GitHub username
    2. the repository name of your Foam repo
    3. the GitHub access token from step 7
    4. An author name
11. Check your Github repo for a commit
12. If you are publishing your Foam to the web you may want to edit your publishing configuration to exclude inbox files - as publishing (and method) is a user choice that is beyond the scope of this recipe

## Code for Drafts Action

```javascript
// adapted from https://forums.getdrafts.com/t/script-step-post-to-github-without-working-copy/3594
// post to writing inbox in Foam digital garden

/*
 * edit these lines to suit your preferences
 */
const inboxFolder = "inbox/";   // the folder in your Foam repo where notes are saved. MUST have trailing slash, except for root of repo use ''
const requiredTags = ['inbox']; // all documents will have these added in addition to tags from the Drafts app
const addLinkToInbox = true;    // true = created note will have link to [[index]], false = no link
const addTimeStamp = true;      // true = add a note of capture date/time at foot of note

/*
 * stop editing
 */

const credential = Credential.create("GitHub garden repo", "The repo name, and its credentials, hosting your Foam notes");
credential.addTextField("username", "GitHub Username");
credential.addTextField('repo', 'Repo name');
credential.addPasswordField("key", "GitHub personal access token");
credential.addTextField('author', 'Author');
credential.authorize();

const githubKey = credential.getValue('key');
const githubUser = credential.getValue('username');
const repo = credential.getValue('repo');
const author = credential.getValue('author');

const http = HTTP.create(); // create HTTP object
const base = 'https://api.github.com';


const posttime = new Date();
const title = draft.title;  
const txt = draft.processTemplate("[[line|3..]]");
const mergedTags = [...draft.tags, ...requiredTags];
const slugbase = title.toLowerCase().replace(/\s/g, "-");

const datestr = `${posttime.getFullYear()}-${pad(posttime.getMonth() + 1)}-${pad(posttime.getDate())}`;
const timestr = `${pad(posttime.getHours())}:${pad(posttime.getMinutes())}:00`;
const yr = `${posttime.getFullYear()}`;
const pdOffset = posttime.getTimezoneOffset();
const offsetChar = pdOffset >= 0 ? '-' : '+';
var pdHours = Math.floor(pdOffset/60);
console.log(pdHours);
pdHours = pdHours >= 0 ? pdHours : pdHours * -1;
console.log(pdHours);
const tzString = `${offsetChar}${pad(pdHours)}:00`;
const postdate = `${datestr}T${timestr}${tzString}`;


const slug = `${slugbase}`
const fn = `${slug}.md`;
let preamble = `# ${title} \n\n`;

mergedTags.forEach(function(item,index){
   preamble += `#${item} `;
  }
);

if (addLinkToInbox) {
    preamble += "\n\n[[inbox]]\n";
}

preamble += "\n\n";

var doc = `${preamble}${txt}`;

if (addTimeStamp){

    doc += `\n\nCaptured: ${postdate}\n`
}

const options = {
    url: `https://api.github.com/repos/${githubUser}/${repo}/contents/${inboxFolder}${fn}`,
    method: 'PUT',
    data: {
        message: `Inbox from Drafts ${datestr}`,
        content: Base64.encode(doc)
    },
    headers: {
        'Authorization': `token ${githubKey}`
    }
};

var response = http.request(options);

if (response.success) {
    // yay
} else {
    console.log(response.statusCode);
    console.log(response.error);
}

function pad(n) {
    let str = String(n);
    while (str.length < 2) {
        str = `0${str}`;
    }
    return str;
}

```
