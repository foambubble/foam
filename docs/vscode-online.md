# VSCode online

It is possible to host an instance of Visual Studio Code in the cloud and have an URL with all your files (protectd with a password), being able to use it in any browser and device.

## Foam with DigitalOcean

- Requirements: a DigitalOcean account and Foam hosted in git (GitHub, Azure DevOps, etc). Extra: Needed a domain and a certificate to have a url like: https://foam.yourdomain.com/

### Create the droplet
- Go to: Droplets, push button: "Create Droplet" and over Choose and image go to marketplace and select: "code-server"
- Next choose plan: Basic, 10/mo (I think the 5/mo plan can be not enough)
- Choose a datacenter region (Use the closer to your place)
- Create root password
- Go to the end and press: "Create Droplet"
- When the creation of the droplet is completed, copy the IP Address and press over the name of the new instance.

### Get/change the access password
- Go to Access to the left and press the button "Launch console"
- It will open a web console where the credentials are: root/<root_password_created>
- You will get a welcome message if you are logged.
- To get the password of your account execute in the webconsole: `cat /etc/code-server/pass`
- If you want to change the password, run in the webconsole: `nano /etc/code-server/pass` and put the new password.
- Next, you need to restart the code-server running: `systemctl restart code-server`

### Accesing
- Put the IP Address in the browser and the the password.
- To install foam go to the UI, and use: "Install from VSIX"

### Extra
- If you want to use your own domain, go to droplets, select the code-server droplet and go to the right, select more and "Add a domain"
- If you want https, follow this [tutorial](https://bobcares.com/blog/install-ssl-on-digitalocean-droplet/)
