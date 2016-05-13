var express = require('express');
var _ = require('lodash');
var PeerServer = require('peer').PeerServer;
var server = PeerServer({port: 8080});

var servHttp = express();
servHttp.listen(80);
servHttp.use(express.static(__dirname, {index:'test.html'}));

var Clients=[]; //Utilisation d'une BDD nécessaire si le serveur ferme ?
var Communautes = [];

server.on('connection',function(id){
	Clients.push(id);
});

server.on('disconnect',function(id){
	_.remove(Clients, el=>el==id);
	Communautes.forEach(group => { _.remove(group.clients, el=>el==id)});});

function Group(name){
	this.name=name;
	this.clients=[];
};

setInterval(update,1000);

function update(){
	_.remove(Communautes, el=>el.clients.length==0)
}


servHttp.get('/send/:groupName/:user', function(req, res) {
	groupName=req.params.groupName.toLowerCase()
	var group = Communautes.find((el)=>{return el.name==groupName});
	if(!group){
		group = new Group(groupName);
		Communautes.push(group);
	}
	var clients = group.clients;
	clients.push(req.params.user);
	res.send(clients);
	res.end();
});