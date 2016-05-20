function TchatKernel(){
	this.limite = 5;
	this.nbGarants = 2;
	this.connectedPeers={};
	this.ID;
	this.communautes=[];
	this.timeInterval=1000;
	this.limiteMsgPrive=200;
	this.limiteMsgPublic=300;
	this.limiteMsgPublicConnecte=500;
	this.peer = new Peer({host:'192.168.1.101',port:8080});
	
	this.peer.on('open',(id) => {
		console.log('My peer ID is: ' + id);
		this.ID = id;
	});

	this.peer.on('connection',this._connect.bind(this));

	this.connectedInterval=setInterval(this.connected.bind(this),this.timeInterval);

	this.grouplistInterval=setInterval(this.grouplist.bind(this),2*this.timeInterval);
}

TchatKernel.prototype = Object.create(window.EventEmitter.prototype);

TchatKernel.prototype.connected=function(){
	this.communautes
		.filter(group=>group.connectes.length<this.limite && group.name.charAt(0) == '#')
		.forEach(group=>this.send(group.name,'636f6e6e656374e9'));
}

TchatKernel.prototype.grouplist=function(){
	this.communautes.forEach((communaute)=>{
		if(communaute.garants.length<this.nbGarants && communaute.connectes.length>this.nbGarants){
			var Diff = _.difference(communaute.connectes,communaute.garants,['@'+this.ID])
			_.sampleSize(Diff,this.nbGarants-communaute.garants.length)
				.forEach(id=>{
					this.open(id)
					communaute.garants.push(id)
				})
		}
		if(communaute.connectes.length<this.limite){
			this.emit(communaute.name,communaute.connectes);
		}else{
			this.emit(communaute.name,'Groupe trop grand');
		}
		communaute.connectes.length=0;
	});
}

TchatKernel.prototype._connect = function(c){
	this.emit('connection','@'+c.peer);
	c.on('data',(msg) => {
		if(msg.destination.charAt(0)=='#'){
			var group = this.communautes.find((group)=>group.name==msg.destination)
			if(group){
				var isMsgToRelay = group.addMessage(msg);
				if(isMsgToRelay){
					this._broadcast(msg);
					if(msg.msg != '636f6e6e656374e9') this.emit('message',msg);
				}
			}else{
				return
			}
		}

		if(msg.destination.charAt(0)=='@'){
			var privateName = msg.sender=='@'+this.ID ? msg.destination : msg.sender
			var group = this.communautes.find((group)=>group.name==privateName)
			if(group){
				group.addMessage(msg)
			}else{
				var newGroup = new Group(privateName,this.limiteMsgPrive)
				newGroup.addMessage(msg)
				this.communautes.push(newGroup)
			}
			if(msg.sender!='@'+this.ID) c.send(msg)
			this.emit('message',msg);
		}
	});

	c.on('close',() => {
		this.emit('deconnection','@'+c.peer);
		this.communautes.forEach(group=>_.remove(group.garants,el=>el=='@'+c.peer))
		delete this.connectedPeers[c.peer];
	});
	this.connectedPeers[c.peer]=1;
}

TchatKernel.prototype._broadcast = function(data) {
	_.forEach(this.peer.connections,(co)=>{if(co[0].open) co[0].send(data)});
}

TchatKernel.prototype.open=function(name){
	name = name.toLowerCase();
	if(name.charAt(0)=='#'){
		var groupNotExist = !this.communautes.find((group)=>group.name==name)
		if(groupNotExist){
			var group = new Group(name,this.limiteMsgPublic,this.limiteMsgPublicConnecte);
			this.communautes.push(group);
			name = name.replace('#','%23');
			var http = new XMLHttpRequest();
			http.open('GET','/send/'+name+'/'+this.ID);
			http.send();
			http.onload = () => {
				var Clients=JSON.parse(http.response);
				var Connections = _.keys(this.connectedPeers);
				var Diff = _.difference(Clients,Connections,[this.ID]);
				var connectionCount = Diff.length < this.nbGarants ? Diff.length : this.nbGarants;
				name = name.replace('%23','#')
				var idGarants = _.sampleSize(Diff, connectionCount)
				idGarants.forEach(id=>this.open('@'+id))

				var garantsPeers = idGarants.map(id=>this.peer.connections[id][0])
				group.addGarants(idGarants, garantsPeers,this);
			}
		}
	}

	if(name.charAt(0)=='@'){
		name = name.replace('@','');
		if(!this.connectedPeers[name]){
			var c=this.peer.connect(name);
			c.on('open', () => {
				this._connect(c);
				c.on('error', console.warn.bind(console));
			});
			this.connectedPeers[name]=1;
		}
	}
}

TchatKernel.prototype.send=function(name,message){
	name = name.toLowerCase();
	var msg = new Message(name,message,'@'+this.ID);
	if(name.charAt(0)=='@'){
		name = name.replace('@','');
		var connections = this.peer.connections[name];
		if(connections && connections[0].open){
			connections[0].send(msg);
		}else{
			this.open('@'+name);
			console.warn("La connection est en train de s'ouvrir, veuillez réessayer plus tard");
		}
	}

	if(name.charAt(0)=='#'){
		var group = _.find(this.communautes,(el)=>el.name==name);
		if(group){
			this._broadcast(msg)
			group.addMessage(msg);
			if(msg.msg != '636f6e6e656374e9') this.emit('message',msg);
		}else{
			this.open(name);
			console.warn("La connection est en train de s'ouvrir, veuillez réessayer plus tard");
		}
	}

}

TchatKernel.prototype.clear=function(){
	this.peer.destroy();
	clearInterval(this.connectedInterval)
	clearInterval(this.grouplistInterval)
}

function Group(name,limiteMsg,limiteMsgCo){
	this.name=name;
	this.msgs=[];
	this.msgsconnectes=[];
	this.connectes=[];
	this.garants=[];
	this.limiteMessages=limiteMsg;
	this.limiteMessagesConnecte=limiteMsgCo || 0;
}

Group.prototype._addMessage=function(msg){
	if(this.msgs.length>this.limiteMessages) this.msgs.shift();
	this.msgs.push(msg);
};

Group.prototype._addMessageConnecte=function(msg){
	if(this.msgsconnectes.length>this.limiteMessagesConnecte) this.msgsconnectes.shift()
	this.msgsconnectes.push(msg);
};

Group.prototype._addConnectes=function(sender){
	var duplicatedSender = _.find(this.connectes,id=>id==sender)
	if(!duplicatedSender) this.connectes.push(sender);
}

Group.prototype.addMessage=function(data){
	if(data.msg=='636f6e6e656374e9') {
		this._addConnectes(data.sender);			
		var duplicatedMsg = this.msgsconnectes.find((el)=>el.signature==data.signature)
		if(!duplicatedMsg) this._addMessageConnecte(data);
		return !duplicatedMsg
	}else{
		var duplicatedMsg = this.msgs.find((el)=>el.signature==data.signature)
		if(!duplicatedMsg) this._addMessage(data);
		return !duplicatedMsg
	}
}

Group.prototype.addGarants=function(ids, peers,that){
	ids.forEach(id=>this.garants.push(id))
	peers.forEach(peer=>{
		peer.on('open', ()=>{
			var allPeersOpen = peers.every(peer=>peer.open)
			if(allPeersOpen) that.emit('connection',this.name)
		})
	})
}

function Message(dest,msg,sender){
	this.destination=dest;
	this.msg=msg;
	this.sender=sender;
	this.time=Date.now();
	this.signature=uuid.v4(this);
}

Message.prototype=Object.create(window.Object.prototype);