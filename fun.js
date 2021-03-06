// requestAnim shim layer by Paul Irish
    window.requestAnimFrame = (function(){
      return  window.requestAnimationFrame       || 
              window.webkitRequestAnimationFrame || 
              window.mozRequestAnimationFrame    || 
              window.oRequestAnimationFrame      || 
              window.msRequestAnimationFrame     || 
              function(/* function */ callback, /* DOMElement */ element){
                window.setTimeout(callback, 1000 / 60);
              };
    })();
  

// example code from mr doob : http://mrdoob.com/lab/javascript/requestanimationframe/

var canvas, context, jqueryCanvas;
var sizex = 640, sizey = 480;
var solly;
var sentry;
var bullets;
var lastBullet;
var before;
var inputTrack;
var background;

var dt;
var gravity = 2000;

var rocketUsed = [false, false, false, false];
var rockets = [[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]]; 
//preallocate 4 rockets to save resizing [sx, sy, vx, vy, rad]
//max 4 rockets at any time, like tf2 ammo clip

prep();
startGame();

function prep(){
  canvas = document.createElement("canvas");
  canvas.style.border = "black solid";
  canvas.style.position = "relative";
  canvas.id = "sollygame";
  context = canvas.getContext("2d");
  context.font="18px Calibri";

  canvas.width = sizex;
  canvas.height = sizey;
  document.body.appendChild(canvas);
  jqueryCanvas = $(document.getElementById('sollygame'));
  borderWidth = ~~jqueryCanvas.css("border-left-width")[0];

  background = {};
  background.img = new Image();
  background.imgLoaded = false;
  background.img.onload = function () {
    background.imgLoaded = true;
  };
  background.img.src = "cp_gorge0006.png";

  inputTrack = {
    leftPressed: false,
    rightPressed: false,
    upPressed: false,
    downPressed: false, 
    keyEv: function(event, bool){
      switch(event.keyCode) {
        case 37: 
        case 65: inputTrack.leftPressed = bool; break;
        case 32: 
        case 38: 
        case 87: inputTrack.upPressed = bool; break;
        case 39: 
        case 68: inputTrack.rightPressed = bool; break;
        case 40: 
        case 83: inputTrack.downPressed = bool; break;
      }
    },
    leftMouseDown: false,
    mouseX: 0,
    mouseY: 0,
    leftMouseTime: 0,
    mouseEv: function(event, bool) {
      if (event.button == 0)
        inputTrack.leftMouseDown = bool;
      inputTrack.mouseX = event.pageX - jqueryCanvas.offset().left - borderWidth;
      inputTrack.mouseY = event.pageY - jqueryCanvas.offset().top - borderWidth;
    },
    updateFireTime: function(time) {
      if (inputTrack.leftMouseTime < time)
        inputTrack.leftMouseTime = time;
    },
    reset: function() {
      inputTrack.leftPressed = false;
      inputTrack.rightPressed = false;
      inputTrack.upPressed = false;
      inputTrack.downPressed = false;
      inputTrack.leftMouseDown = false;
    }
  };
  $(document).on("keydown", function(event) { inputTrack.keyEv(event, true); });
  $(document).on("keyup", function(event) { inputTrack.keyEv(event, false); });
  $(document).on("mousedown", function(event) { inputTrack.mouseEv(event, true); inputTrack.updateFireTime(Date.now()); });
  $(document).on("mouseup", function(event) { inputTrack.mouseEv(event, false); });
  $(document).on("mousemove", function(event) { inputTrack.mouseEv(event, inputTrack.leftMouseDown); });


  //document.addEventListener('keydown', function(event) { inputTrack.keyEv(event, true); }, false);
  //document.addEventListener('keyup', function(event) { inputTrack.keyEv(event, false); }, false);
  //window.addEventListener('mousedown', function(event) { inputTrack.mouseEv(event, true); }, false);
  //window.addEventListener('mouseup', function(event) { inputTrack.mouseEv(event, false); }, false);
  //window.addEventListener('mousemove', function(event) { inputTrack.mouseEv(event, inputTrack.leftMouseDown); }, false);
}

function Solly(){
  var self = this;
  self.x = sizex/2;
  self.y = sizey-50;
  self.vx = 0; //max 160 pixels per second
  self.vy = 0;
  self.hp = 100;
  self.facingLeft = true; //false is facingRight
  self.sprite = {};
  self.sprite.img = new Image();
  self.sprite.imgLoaded = false;
  self.sprite.img.onload = function () {
    self.sprite.imgLoaded = true;
  };
  self.sprite.img.src = "sollysprite.png";
  self.sprite.ctr = 0; //counter
  self.sprite.ctrskp = 4; //counter skip, i.e. framerate
  self.sprite.moving = false;
  self.rocket = {};
  self.rocket.img = new Image();
  self.rocket.imgLoaded = false;
  self.rocket.img.onload = function () {
    self.rocket.imgLoaded = true;
  }; 
  self.rocket.img.src = "rocket.png";
  self.maxSpeedX = 160;
  self.maxSpeedY = 500;
  self.sprite.jumping = false;
  self.rocketWait = 500; //firespeed in ms of rocket launcher
  self.rocketSpeed = 480;
  self.rocketDamage = 20;
  self.sentryKills = 0;
  self.fireRocket = function(xi, yi, xf, yf){
    for (i=0; i<4; ++i)
      if (!rocketUsed[i])
      {
        rocketUsed[i]=true;
        rockets[i][0]=xi;
        rockets[i][1]=yi;
        var factor = Math.sqrt(Math.pow(xf-xi,2)+Math.pow(yf-yi,2))/solly.rocketSpeed;
        rockets[i][2] = (xf-xi)/factor;
        rockets[i][3] = (yf-yi)/factor;
        rockets[i][4] = Math.atan2(xf-xi,(yf-yi)*-1); //-1 because y axis is flipped    
        break;
      }
  };
  self.advance = function(now) {
    //LEFT or RIGHT button handle
    if (inputTrack.leftPressed || inputTrack.rightPressed)
    {
      solly.sprite.moving = true;
      solly.ctr = 0;
      if (inputTrack.leftPressed){
        solly.facingLeft=true;
        solly.vx=-solly.maxSpeedX;
      }
      if (inputTrack.rightPressed){
        solly.facingLeft=false;
        solly.vx=solly.maxSpeedX;
      }
    }
    else {
      if (solly.sprite.moving)
        solly.sprite.moving=false;
      if (!solly.sprite.jumping)
        solly.vx =0;
    }
    //UP button handle
    if (inputTrack.upPressed)
    {
      if (!solly.sprite.jumping){
        solly.vy=-solly.maxSpeedY;
        solly.sprite.jumping=true;
      }
    }
    //Mouse action, firing weapon
    if (inputTrack.leftMouseDown)
    {
      if (now>=inputTrack.leftMouseTime){
        solly.fireRocket(solly.x, solly.y, inputTrack.mouseX, inputTrack.mouseY);

        while(now>=inputTrack.leftMouseTime)
          inputTrack.leftMouseTime+=solly.rocketWait;
      }
    }

    solly.x+=solly.vx/1000*dt;//velocities
    solly.y+=solly.vy/1000*dt;
    if (solly.x<50) //no infinite move left
      solly.x=50;
    else if (solly.x >sizex-50) //no infinite move right
      solly.x=sizex-50;

    if (solly.y<sizey-50) //gravity
      solly.vy+=gravity/1000*dt;
    if (solly.y>sizey-50){ //no clip through ground
      solly.y=sizey-50;
      solly.vy=0;
      solly.sprite.jumping=false;
    }

    for (i=0; i<4; ++i)
      if (rocketUsed[i]){
        rockets[i][0]+=rockets[i][2]/1000*dt;
        rockets[i][1]+=rockets[i][3]/1000*dt;
      }

  };
}

function Sentry(){
  var self = this;
  self.hp = 100;
  self.x = Math.random()*(sizex-100)+50;
  self.y = 120;
  self.sprite = {};
  self.sprite.img = new Image();
  self.sprite.imgLoaded = false;
  self.sprite.img.onload = function () {
    self.sprite.imgLoaded = true;
  };
  self.sprite.img.src = "sentrysprite.png";
  self.sprite.ctr = 0; //counter
  self.sprite.ctrskp = 8; //counter skip, i.e. framerate
  self.tracking = true;
  self.shootAtEnemy = function(enemy){
    if (lastBullet == null || bullets == null) {
      bullets = new Bullet(self.x, self.y, enemy.x, enemy.y);
      lastBullet = bullets;
    }
    else {
      lastBullet.next = new Bullet(self.x, self.y, enemy.x, enemy.y)
      lastBullet.next.prev = lastBullet;
      lastBullet = lastBullet.next;
    }
    self.bulletCount++;
  };
  self.bulletSpeed = 400;
  self.lastBulletTime = 0;
  self.bulletShootWait = 100;
  self.bulletCount = 0;
  self.advance = function(now) {
    if (sentry.tracking && now-sentry.lastBulletTime>sentry.bulletShootWait && sentry.bulletCount<6) {
      sentry.lastBulletTime = now;
      sentry.shootAtEnemy(solly);
    }
    if (bullets!=null) {
      for (b = bullets; b; b = b.next) {
        b.x+=b.vx/1000*dt;
        b.y+=b.vy/1000*dt;
      }
    }
  };
}

function Bullet(_xi, _yi, _xf, _yf){
  this.x=_xi;
  this.y=_yi;
  var factor = Math.sqrt(Math.pow(_xf-_xi,2)+Math.pow(_yf-_yi,2))/sentry.bulletSpeed;
  this.vx = (_xf-_xi)/factor;
  this.vy = (_yf-_yi)/factor;
  this.angle = Math.atan2(_xf-_xi,(_yf-_yi)*-1); //-1 because y axis is flipped
  this.prev=null;
  this.next=null;
  this.removeBullet = function (thisBullet) {
    if (thisBullet.prev!=null && thisBullet.next!=null) {//remove from middle
      thisBullet.prev.next = thisBullet.next;
      thisBullet.next.prev = thisBullet.prev;
      thisBullet.next = null;
      thisBullet.prev = null;
    } else if (thisBullet.prev==null && thisBullet.next!=null) { //remove from beginning
      bullets = thisBullet.next;
      thisBullet.next.prev = null;
      thisBullet.next = null;
      thisBullet.prev = null;
    }
    else { //remove from end
      if (thisBullet.prev!=null) {//not last one
        thisBullet.prev.next=null;
        lastBullet = thisBullet.prev;
      } else {
        lastBullet = null;
        bullets = null;
      }
      thisBullet.next = null;
      thisBullet.prev = null;
    }
    sentry.bulletCount--;
  };
  this.damage = 5;
}

function reset(){
  solly = new Solly();
  bullets = null;
  lastBullet = null;
  sentry = new Sentry();
  inputTrack.reset();
  for (i=0; i<4; ++i)
  {
    rocketUsed[i]=false;
  }
}

function startGame(){
  reset();
  before = Date.now();
  loop();
}


function loop() {
  var now = Date.now();
  dt = now-before;
  before = now;

  solly.advance(now);
  sentry.advance(now);


  //bullet cleanup
  if (bullets!=null) {
    for (b = bullets; b!=null; b = b.next) {
      if (Math.sqrt(Math.pow(b.x-solly.x,2) + Math.pow(b.y-solly.y,2))<25) {
        solly.hp-=b.damage;
        b.removeBullet(b);
      }
      else if (b.y > sizey || b.x < 0 || b.x > sizex || b.y <0)
        b.removeBullet(b);
    }
  }
  //rocket cleanup
  for (i=0; i<4; ++i)
  {
    if (rocketUsed[i]) {
      if (Math.sqrt(Math.pow(rockets[i][0]-sentry.x,2) + Math.pow(rockets[i][1]-sentry.y,2))<25) {
        sentry.hp-=solly.rocketDamage;
        rocketUsed[i]=false;  
      }
      else if (rockets[i][1]<0 || rockets[i][0] <0 || rockets[i][0] > sizex || rockets[i][1]> sizey)
        rocketUsed[i]=false;
    }
  }

  var cont = true;
  if (sentry.hp<=0) {
    sentry.hp=0;
    solly.sentryKills++;
    var temp = sentry.bulletCount;
    sentry = new Sentry();
    sentry.bulletCount = temp;
  }

  if (solly.hp<=0) {
    solly.hp=0;
    cont=false;
  }

  draw();
  if (cont)
    requestAnimationFrame(loop);
  else {
    //alert("Oh dear, you are dead! Click to restart.")
    requestAnimationFrame(endGameDisplay)
    //endGameDisplay();
    //startGame();
  }
}


function endGameDisplay() {
  context.fillStyle = 'red';
  context.fillRect(sizex/2-100, sizey/2-60, 200, 120);
  context.fillStyle = 'white';
  context.fillRect(sizex/2-98, sizey/2-58, 196, 116);
  context.fillStyle = 'black';
  context.font="20px Calibri";
  context.fillText("Oh dear, you are dead!", sizex/2-95, sizey/2-30);
  context.fillText("Score: "+solly.sentryKills, sizex/2-35, sizey/2-5);
  
  context.fillStyle = 'red';
  context.fillRect(sizex/2-50, sizey/2+20, 100, 20);
  context.fillStyle = 'white';
  context.fillRect(sizex/2-48, sizey/2+22, 96, 16);
  context.fillStyle = 'black';
  context.font="14px Calibri";
  context.fillText("Restart.", sizex/2-25, sizey/2+35);

  if(!(inputTrack.leftMouseDown && 
          inputTrack.mouseX>=sizex/2-50 && 
          inputTrack.mouseX<=sizex/2+100 && 
          inputTrack.mouseY>=sizey/2+10 && 
          inputTrack.mouseY<=sizey/2+30)) {
            requestAnimationFrame(endGameDisplay);
          }
   else {
     startGame();
   }

  
}



function draw() {
  context.clearRect(0, 0, sizex, sizey);
  if (background.imgLoaded)
    context.drawImage(background.img, 0, 0);
  if (solly.sprite.imgLoaded){
    
    if (solly.sprite.moving) {
      xcoord=(~~(solly.sprite.ctr/solly.sprite.ctrskp))*48;
      ycoord=(solly.facingLeft?0:100);
    }
    else {
      xcoord=(~~(solly.sprite.ctr/solly.sprite.ctrskp/3))*48;
      ycoord=(solly.facingLeft?50:150);
    }

    context.drawImage(solly.sprite.img, xcoord, ycoord, 48, 50, ~~(solly.x-48/2), ~~(solly.y-50/2), 48, 50);
    context.fillStyle = 'red';
    context.fillRect(~~(solly.x-25), ~~(solly.y-50/2)-5, ~~solly.hp/2, 6);
    
    if (solly.sprite.moving)
      solly.sprite.ctr = (solly.sprite.ctr+1)%(10*solly.sprite.ctrskp);
    else
      solly.sprite.ctr = (solly.sprite.ctr+1)%(4*3*solly.sprite.ctrskp);
      
  }

  if (sentry.sprite.imgLoaded){
    
    xcoord=(~~(sentry.sprite.ctr/sentry.sprite.ctrskp))*62;
    ycoord=0;

    context.drawImage(sentry.sprite.img, xcoord, ycoord, 39, 38, ~~(sentry.x-39/2), ~~(sentry.y-39/2), 39, 38); //xold 62
    context.fillStyle = 'red';
    context.fillRect(~~(sentry.x-25), ~~(sentry.y-39/2)-5, ~~sentry.hp/2, 6);
    
    sentry.sprite.ctr = (sentry.sprite.ctr+1)%(13*sentry.sprite.ctrskp);
  }

  
  if (solly.rocket.imgLoaded){ 
    for (i=0; i<4; ++i)
    {
      if (rocketUsed[i])
      {
        context.save();
        context.translate(rockets[i][0], rockets[i][1]);
        context.rotate(rockets[i][4]);

        context.drawImage(solly.rocket.img, -(9/2), -(48/2));
        context.restore();
      }
    }
  }
  
  //bullets
  if (bullets!=null){
    for (b = bullets; b; b = b.next) {
      context.beginPath();
      context.arc(b.x, b.y, 3, 0, 2 * Math.PI, false);
      context.fillStyle = 'black';
      context.fill();
      context.lineWidth = 2;
      context.strokeStyle = 'yellow';
      context.stroke();
      context.closePath();
    }
  }
  
  context.beginPath();
  context.arc(inputTrack.mouseX, inputTrack.mouseY, 4, 0, 2 * Math.PI, false);
  context.lineWidth = 2;
  context.strokeStyle = 'black';
  context.stroke();
  context.closePath();
  
  context.fillStyle = 'black';
  context.fillText("Score: "+solly.sentryKills, sizex-75, 20);
}
