function Tchat(){
	this.tchat= new TchatKernel()

	this.tchat.on('message', (msg)=>{
		this.addMessageToTab(msg)
	})

	this.tchat.on('deconnection', (id)=>{
		this.clearTab(id)
	})

	this.tchat.on('connection',console.log.bind(console,'connection'))

	this.tchat.on('groupList', console.log.bind(console))
}

Tchat.prototype.addMessageToTab=function(msg){
	this.tchat.communautes.forEach(communaute=>{
		if(_.find(communaute.msgs,el=>el.signature==msg.signature)) Communaute=communaute
	})
	tabexist = document.getElementById(Communaute.name)
	if(tabexist){
		tabexist.value+=msg.sender+' : '+msg.msg+'\n'
	}else{
		var tab = document.createElement("textarea")
		tab.id=Communaute.name
		tab.style.height=300+'px'
		tab.style.width=200+'px'
		tab.value+=msg.sender+' : '+msg.msg+'\n'
		document.body.appendChild(tab)
	}
}

Tchat.prototype.clearTab=function(id){
	tabexist = document.getElementById(id)
	if(tabexist) tabexist.value+=id+'a quitté le tchat \n'
}