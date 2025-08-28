(function() {
	var timeouts = [];
	var messageName = "zero-timeout-message";

	function setZeroTimeout(fn) {
		timeouts.push(fn);
		window.postMessage(messageName, "*");
	}

	function handleMessage(event) {
		if (event.source == window && event.data == messageName) {
			event.stopPropagation();
			if (timeouts.length > 0) {
				var fn = timeouts.shift();
				fn();
			}
		}
	}

	window.addEventListener("message", handleMessage, true);

	window.setZeroTimeout = setZeroTimeout;
})();

var Neuvol;
var game;
var FPS = 60;
var maxScore=0;
var isPaused = false;
var currentSpeed = 60;

var images = {};

var speed = function(fps){
	FPS = parseInt(fps);
	currentSpeed = fps;
	updateSpeedIndicator();
}

var togglePause = function(){
	isPaused = !isPaused;
	var pauseBtn = document.getElementById('pauseBtn');
	var statusIndicator = document.getElementById('status-indicator');
	
	if(isPaused){
		pauseBtn.innerHTML = '▶️ Resume';
		pauseBtn.classList.add('paused');
		statusIndicator.classList.add('paused');
	} else {
		pauseBtn.innerHTML = '⏸️ Pause';
		pauseBtn.classList.remove('paused');
		statusIndicator.classList.remove('paused');
		// Resume the game loop
		if(game){
			game.update();
		}
	}
}

var resetGame = function(){
	if(game){
		game.reset();
	}
}

var updateSpeedIndicator = function(){
	var statusIndicator = document.getElementById('status-indicator');
	if(statusIndicator){
		if(currentSpeed === 0){
			statusIndicator.style.animationDuration = '0.3s';
		} else {
			statusIndicator.style.animationDuration = Math.max(0.5, 2 - (currentSpeed / 100)) + 's';
		}
	}
}

// Keyboard shortcuts for better user experience
document.addEventListener('keydown', function(event) {
	switch(event.key) {
		case ' ':  // Spacebar for pause/resume
		case 'p':  // P for pause/resume
		case 'P':
			event.preventDefault();
			togglePause();
			break;
		case 'r':  // R for reset
		case 'R':
			event.preventDefault();
			resetGame();
			break;
		case '1':  // Number keys for speed control
			speed(60);
			break;
		case '2':
			speed(120);
			break;
		case '3':
			speed(180);
			break;
		case '5':
			speed(300);
			break;
		case '0':  // 0 for MAX speed
		case 'm':
		case 'M':
			speed(0);
			break;
	}
});

// Performance optimization: throttled resize handler
var resizeTimeout;
window.addEventListener('resize', function() {
	clearTimeout(resizeTimeout);
	resizeTimeout = setTimeout(function() {
		if(game && game.canvas) {
			// Maintain aspect ratio on resize
			var container = game.canvas.parentElement;
			var containerWidth = container.clientWidth - 40; // Account for padding
			if(containerWidth < 500) {
				game.canvas.style.width = containerWidth + 'px';
				game.canvas.style.height = (containerWidth * 512/500) + 'px';
			} else {
				game.canvas.style.width = '500px';
				game.canvas.style.height = '512px';
			}
		}
	}, 100);
});

var loadImages = function(sources, callback){
	var nb = 0;
	var loaded = 0;
	var imgs = {};
	for(var i in sources){
		nb++;
		imgs[i] = new Image();
		imgs[i].src = sources[i];
		imgs[i].onload = function(){
			loaded++;
			if(loaded == nb){
				callback(imgs);
			}
		}
	}
}

var Bird = function(json){
	this.x = 80;
	this.y = 250;
	this.width = 40;
	this.height = 30;

	this.alive = true;
	this.gravity = 0;
	this.velocity = 0.3;
	this.jump = -6;

	this.init(json);
}

Bird.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

Bird.prototype.flap = function(){
	this.gravity = this.jump;
}

Bird.prototype.update = function(){
	this.gravity += this.velocity;
	this.y += this.gravity;
}

Bird.prototype.isDead = function(height, pipes){
	if(this.y >= height || this.y + this.height <= 0){
		return true;
	}
	for(var i in pipes){
		if(!(
			this.x > pipes[i].x + pipes[i].width ||
			this.x + this.width < pipes[i].x || 
			this.y > pipes[i].y + pipes[i].height ||
			this.y + this.height < pipes[i].y
			)){
			return true;
	}
}
}

var Pipe = function(json){
	this.x = 0;
	this.y = 0;
	this.width = 50;
	this.height = 40;
	this.speed = 3;

	this.init(json);
}

Pipe.prototype.init = function(json){
	for(var i in json){
		this[i] = json[i];
	}
}

Pipe.prototype.update = function(){
	this.x -= this.speed;
}

Pipe.prototype.isOut = function(){
	if(this.x + this.width < 0){
		return true;
	}
}

var Game = function(){
	this.pipes = [];
	this.birds = [];
	this.score = 0;
	this.canvas = document.querySelector("#flappy");
	this.ctx = this.canvas.getContext("2d");
	this.width = this.canvas.width;
	this.height = this.canvas.height;
	this.spawnInterval = 90;
	this.interval = 0;
	this.gen = [];
	this.alives = 0;
	this.generation = 0;
	this.backgroundSpeed = 0.5;
	this.backgroundx = 0;
	this.maxScore = 0;
}

Game.prototype.start = function(){
	this.interval = 0;
	this.score = 0;
	this.pipes = [];
	this.birds = [];

	this.gen = Neuvol.nextGeneration();
	for(var i in this.gen){
		var b = new Bird();
		this.birds.push(b)
	}
	this.generation++;
	this.alives = this.birds.length;
}

Game.prototype.reset = function(){
	// Reset the entire neuroevolution and start fresh
	Neuvol = new Neuroevolution({
		population:50,
		network:[2, [2], 1],
	});
	this.generation = 0;
	this.maxScore = 0;
	maxScore = 0;
	this.start();
}

Game.prototype.update = function(){
	// Check if game is paused
	if(isPaused){
		var self = this;
		setTimeout(function(){
			self.update();
		}, 100); // Check again in 100ms
		return;
	}
	
	this.backgroundx += this.backgroundSpeed;
	var nextHoll = 0;
	if(this.birds.length > 0){
		for(var i = 0; i < this.pipes.length; i+=2){
			if(this.pipes[i].x + this.pipes[i].width > this.birds[0].x){
				nextHoll = this.pipes[i].height/this.height;
				break;
			}
		}
	}

	for(var i in this.birds){
		if(this.birds[i].alive){

			var inputs = [
			this.birds[i].y / this.height,
			nextHoll
			];

			var res = this.gen[i].compute(inputs);
			if(res > 0.5){
				this.birds[i].flap();
			}

			this.birds[i].update();
			if(this.birds[i].isDead(this.height, this.pipes)){
				this.birds[i].alive = false;
				this.alives--;
				//console.log(this.alives);
				Neuvol.networkScore(this.gen[i], this.score);
				if(this.isItEnd()){
					this.start();
				}
			}
		}
	}

	for(var i = 0; i < this.pipes.length; i++){
		this.pipes[i].update();
		if(this.pipes[i].isOut()){
			this.pipes.splice(i, 1);
			i--;
		}
	}

	if(this.interval == 0){
		var deltaBord = 50;
		var pipeHoll = 120;
		var hollPosition = Math.round(Math.random() * (this.height - deltaBord * 2 - pipeHoll)) +  deltaBord;
		this.pipes.push(new Pipe({x:this.width, y:0, height:hollPosition}));
		this.pipes.push(new Pipe({x:this.width, y:hollPosition+pipeHoll, height:this.height}));
	}

	this.interval++;
	if(this.interval == this.spawnInterval){
		this.interval = 0;
	}

	this.score++;
	this.maxScore = (this.score > this.maxScore) ? this.score : this.maxScore;
	var self = this;

	if(FPS == 0){
		setZeroTimeout(function(){
			self.update();
		});
	}else{
		setTimeout(function(){
			self.update();
		}, 1000/FPS);
	}
}


Game.prototype.isItEnd = function(){
	for(var i in this.birds){
		if(this.birds[i].alive){
			return false;
		}
	}
	return true;
}

Game.prototype.display = function(){
	this.ctx.clearRect(0, 0, this.width, this.height);
	for(var i = 0; i < Math.ceil(this.width / images.background.width) + 1; i++){
		this.ctx.drawImage(images.background, i * images.background.width - Math.floor(this.backgroundx%images.background.width), 0)
	}

	for(var i in this.pipes){
		if(i%2 == 0){
			this.ctx.drawImage(images.pipetop, this.pipes[i].x, this.pipes[i].y + this.pipes[i].height - images.pipetop.height, this.pipes[i].width, images.pipetop.height);
		}else{
			this.ctx.drawImage(images.pipebottom, this.pipes[i].x, this.pipes[i].y, this.pipes[i].width, images.pipetop.height);
		}
	}

	this.ctx.fillStyle = "#FFC600";
	this.ctx.strokeStyle = "#CE9E00";
	for(var i in this.birds){
		if(this.birds[i].alive){
			this.ctx.save(); 
			this.ctx.translate(this.birds[i].x + this.birds[i].width/2, this.birds[i].y + this.birds[i].height/2);
			this.ctx.rotate(Math.PI/2 * this.birds[i].gravity/20);
			this.ctx.drawImage(images.bird, -this.birds[i].width/2, -this.birds[i].height/2, this.birds[i].width, this.birds[i].height);
			this.ctx.restore();
		}
	}

	// Enhanced statistics display with better styling
	this.ctx.save();
	
	// Create a semi-transparent background for statistics
	this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
	this.ctx.fillRect(5, 5, 240, 130);
	this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
	this.ctx.fillRect(5, 5, 240, 130);
	
	// Display statistics with better formatting
	this.ctx.fillStyle = "#ffffff";
	this.ctx.font="bold 18px Oswald, sans-serif";
	this.ctx.fillText("📊 Statistics", 15, 25);
	
	this.ctx.font="16px Oswald, sans-serif";
	this.ctx.fillStyle = "#f1c40f";
	this.ctx.fillText("Current Score: " + this.score, 15, 50);
	
	this.ctx.fillStyle = "#e74c3c";
	this.ctx.fillText("Best Score: " + this.maxScore, 15, 70);
	
	this.ctx.fillStyle = "#3498db";
	this.ctx.fillText("Generation: " + this.generation, 15, 90);
	
	// Color-coded alive count
	var alivePercentage = this.alives / Neuvol.options.population;
	if(alivePercentage > 0.7) {
		this.ctx.fillStyle = "#27ae60";
	} else if(alivePercentage > 0.3) {
		this.ctx.fillStyle = "#f39c12";
	} else {
		this.ctx.fillStyle = "#e74c3c";
	}
	this.ctx.fillText("Alive: " + this.alives + " / " + Neuvol.options.population, 15, 110);
	
	// Speed indicator
	this.ctx.fillStyle = "#9b59b6";
	var speedText = currentSpeed === 0 ? "MAX" : currentSpeed/60 + "x";
	this.ctx.fillText("Speed: " + speedText, 15, 130);
	
	// Pause indicator
	if(isPaused) {
		this.ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
		this.ctx.fillRect(0, 0, this.width, this.height);
		this.ctx.fillStyle = "#ffffff";
		this.ctx.font="bold 48px Oswald, sans-serif";
		this.ctx.textAlign = "center";
		this.ctx.fillText("⏸️ PAUSED", this.width/2, this.height/2);
		this.ctx.font="24px Oswald, sans-serif";
		this.ctx.fillText("Click Resume to continue", this.width/2, this.height/2 + 50);
		this.ctx.textAlign = "start";
	}
	
	this.ctx.restore();

	var self = this;
	requestAnimationFrame(function(){
		self.display();
	});
}

window.onload = function(){
	var sprites = {
		bird:"./img/bird.png",
		background:"./img/background.png",
		pipetop:"./img/pipetop.png",
		pipebottom:"./img/pipebottom.png"
	}

	var start = function(){
		Neuvol = new Neuroevolution({
			population:50,
			network:[2, [2], 1],
		});
		game = new Game();
		game.start();
		game.update();
		game.display();
		
		// Initialize UI indicators
		updateSpeedIndicator();
	}


	loadImages(sprites, function(imgs){
		images = imgs;
		start();
	})

}
