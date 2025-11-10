# goofy discord torn bot

this is mainly linux instruction, you can install WSL if you wanna do this on windows,
should work the same, i dont know how docker works on mac so good luck i guess

<details>

<summary>Docker</summary>

you need `git`, `docker`, and `docker-compose`

## setup

clone the repo with `git clone https://github.com/CesiumCs/tornbot.git`

edit `default.config.json` into `config.json`

copy `docker-compose.yml.default` to `docker.compose.yml` and tweak if needed

spin it up `docker-compose up -d`, which should handle dependencies and building the container and all that

## updating

pull changes with `git pull`

bring the container down with `docker-compose down` and spin it up with `docker-compose up --build -d` to rebuild the container
(i usually run `git pull && docker-compose down && docker-compose up --build -d` to do all that in one command)

## registering commands

this doesnt register its commands with discord by default

while the container is running, exec `node deploy-commands.js` inside of it: like `docker exec -t tornbot_bot_1 node deploy-commands.js`

</details>

<details>

<summary>not Docker</summary>

you need `git`, `node`, and `npm`

## setup

clone the repo with `git clone https://github.com/CesiumCs/tornbot.git`

edit `default.config.json` into `config.json`

install dependencies with `npm i`

run with `node index.js`

## updating

pull changes with `git pull`

restarting will apply updates

## registering commands

this doesnt register its commands with discord by default

run `node deploy-commands.js`

</details>
