'use strict';
function scale(percent, min, max) { return (max-min)*percent + min }
function random_float(min, max) { return scale(Math.random(), min, max) }
function random_int(min, max) { return Math.floor(random_float(min, max)); }
function direction(rad, speed) { return {dx: Math.cos(rad)*speed, dy: Math.sin(rad)*speed } }
function random_direction(speed) { return direction(random_float(0, 2*Math.PI), speed) }
function random_color() {
    const red = random_float(0, 255);
    const green = random_float(0, 255);
    const blue = random_float(0, 255);
    return `rgba(${red}, ${green}, ${blue}, 0.5)`
}
function random_color_red() {
    const red = random_float(150, 255);
    const green = random_float(0, 100);
    const blue = random_float(0, 50);
    return `rgba(${red}, ${green}, ${blue}, 1)`
}
function random_color_blue() {
    const red = random_float(0, 50);
    const blue = random_float(150, 255);
    const green = random_float(0, 255);
    return `rgba(${red}, ${green}, ${blue}, 1)`
}

class GameObject {
    destroyed=false
    tags = []
    constructor(e, a) {
        this.e = e;
        this.x = a.x || this.e.position().left;
        this.y = a.y || this.e.position().top;
        this.width = this.e.width();
        this.height = this.e.height()
        if (a.color) this.e.css("background-color", a.color);
    }
    get collision() {
        return {
            minx: this.x,
            miny: this.y,
            maxx: this.x + this.width,
            maxy: this.y + this.height,
        }
    }
    tick(g) {
        // Destroy objects when they exit the game field
        if (this.x < g.screen.minX
            || this.x > g.screen.maxX
            || this.y < g.screen.minY
            || this.y > g.screen.maxY) this.destroy();
    }
    render(g) {
        this.e.css("left", `${this.x}px`);
        this.e.css("top", `${this.y}px`);
    }
    destroy() {
        this.destroyed = true;
        this.e.remove();
    }
}

class Band extends GameObject {
    timeSinceBubble = 0
    bubbleRate = 40.0 // Bubbles per second
    bubbleTime = 1.0/this.bubbleRate
    angularSpeed = 1 // Radians per second
    angle = 0
    paused = true
    bulletSpeed = 100.0
    health = 1.0
    constructor(e, options) {
        super(e, options);
        this.colorf = options.colorf;
        this.audio = options.audio || this.e;
        this.angularSpeed = options.angularSpeed || this.angularSpeed;
        this.audio[0].volume = this.maxVolume = options.maxVolume;
        this.team = options.team;
        this.borderColor = options.borderColor;

        this.audio.on("play", () => {
            this.paused = false;
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                this.audioSource = this.audioCtx.createMediaElementSource(this.audio[0]);
                this.analyser = window.analyser = this.audioCtx.createAnalyser();
            }
            this.audioSource.connect(this.analyser);
            this.analyser.connect(this.audioCtx.destination);
        });
        this.audio.on("pause", () => {
            this.paused = true;
            this.audioSource.disconnect();
            this.analyser.disconnect();
        });
    }
    get middle() {
        return {
            x: this.e.position().left + this.e.width()/2,
            y: this.e.position().top + this.e.height()/2,
        }
    }
    damage(amount) {
        amount ||= 1;
        this.health -= amount;
        this.opponent.heal(amount);
    }
    heal(amount) {
        amount ||= 1;
        this.health = Math.min(1, this.health + amount);
    }
    tick(g) {
        if (this.health <= 0) {
            g.blam(this, 100);
            this.destroy();
            this.opponent.audio.prop("loop", "");
        }
        if (this.paused) return;
        this.angle += this.angularSpeed * g.elapsed;
        this.timeSinceBubble += g.elapsed;
        this.audio[0].volume = this.maxVolume * Math.max(0, this.health);
        if (this.timeSinceBubble > this.bubbleTime) {
            this.timeSinceBubble -= this.bubbleTime;
            const part = Date.now()/1000.0 % 1.0; // Cycles of one second
            const options = {
                x: this.middle.x,
                y: this.middle.y,
                dx: this.bulletSpeed*Math.cos(this.angle),
                dy: this.bulletSpeed*Math.sin(this.angle),
                color: this.colorf(),
            };
            const bullet = g.add(FlyingBubble, $(`<div class="bubble ${this.team}"></div>`), options, [this.team+"Bullet"]);
        }
    }
    render(g) {
        this.e.css("border-color", this.borderColor(this.health));
    }
}

// TODO: Smoother animation with CSS instead of javascript?
class Poof extends GameObject {
    constructor(e, options) {
        options.color = random_color();
        super(e, options);
        this.dir = random_direction(random_float(50, 200));
        this.e.height(options.size);
        this.e.width(options.size);
        this.countdown = options.countdown;
    }
    tick(g) {
        super.tick(g)
        this.x += this.dir.dx * g.elapsed;
        this.y += this.dir.dy * g.elapsed;
        this.countdown -= g.elapsed;
        if (this.countdown < 0) this.destroy();
    }
}
class FlyingBubble extends GameObject {
    countdown = 15;
    bounceTime = 2;
    constructor(e, options) {
        super(e, options);
        this.dx = options.dx
        this.dy = options.dy
    }
    tick(g) {
        super.tick(g)
        this.x += this.dx * g.elapsed;
        this.y += this.dy * g.elapsed;
        this.countdown -= g.elapsed;
        if (this.x < g.screen.minX) {
            this.x = g.screen.minX;
            this.dx *= -1;
            this.countdown -= this.bounceTime;
        } else if (this.x > g.screen.maxX) {
            this.x = g.screen.maxX;
            this.dx *= -1;
            this.countdown -= this.bounceTime;
        }
        if (this.y < g.screen.minY) {
            this.y = g.screen.minY;
            this.dy *= -1;
            this.countdown -= this.bounceTime;
        } else if (this.y > g.screen.maxY) {
            this.y = g.screen.maxY;
            this.dy *= -1;
            this.countdown -= this.bounceTime;
        }
        if (this.countdown <= 0) this.destroy();
    }
    render(g) {
        super.render(g);
        this.e.css("opacity", scale(this.countdown/10.0, 0.3, 1));
    }
}

class Game {
    gameObjects = {} // Dict so we can easily add and delete during iteration
    colGameObjects = {}
    nextId = 0
    field = $(".game");
    counter = $(".counter");
    elapsed = 0
    collision_handler = {}
    constructor() {
        this.lastUpdate = Date.now();
    }
    g() {
        this.screen = { minX: 0, minY: 0, maxX: this.field.width(), maxY: this.field.height() };
        return this;
    }
    add(cls, e, args, tags, noncolliding) {
        tags ||= []
        e.addClass("game-object");
        this.field.append(e);
        const obj = new cls(e, args)
        const g = this.g();
        obj.render(g);
        this.gameObjects[this.nextId] = obj;
        if (!noncolliding) this.colGameObjects[this.nextId] = obj
        this.nextId++;
        for (let tag of tags) this.tag(tag, obj);
        return obj;
    }
    noAnimate() {
        this.lastUpdate = Date.now();
    }
    animate() {
        const now = Date.now();
        this.elapsed = (now - this.lastUpdate) / 1000.0;
        this.lastUpdate = now;
        let objects = 0;
        const g = this.g();

        for (let oid in this.gameObjects) {
            const o = this.gameObjects[oid];
            o.tick(g);
            o.render(g);
            if (o.destroyed) {
                delete this.gameObjects[oid];
                delete this.colGameObjects[oid];
            } else objects++;
        }
        this.counter.text(objects);
        this.checkCollisions();
    }

    checkCollisions() {
        Object.values(this.colGameObjects).forEach(o1 => {
            Object.values(this.colGameObjects).forEach(o2 => {
                if (this.colliding(o1, o2)) {
                    for (let tag1 of o1.tags) {
                        for (let tag2 of o2.tags) {
                            this.collide(tag1, tag2, o1, o2);
                        }
                    }
                }
            })
        })
    }
    blam(o, size) { // blam/poof idea from http://canonical.org/~kragen/sw/dev3/qvaders
        // Make SIZE**0.5 poofs, of size 1...size
        const num=Math.ceil(Math.sqrt(size));
        for (let i=0; i<num; i++) {
            game.add(Poof, $(`<div class="poof"></div>`), {
                x: o.x,
                y: o.y,
                size: random_int(2,size),
                countdown: Math.log(size)/4,
            }, [], true);
        }

    }
    colliding(o1, o2) {
        if (o1 == o2) return false;
        const c1 = o1.collision, c2=o2.collision;
        if (c1.maxx < c2.minx) return false;
        if (c2.maxx < c1.minx) return false;
        if (c1.maxy < c2.miny) return false;
        if (c2.maxy < c1.miny) return false;
        return true;
    }
    collide(tag1, tag2, o1, o2) {
        let handler = (this.collision_handler[tag1]||{})[tag2];
        if (handler) handler(o1, o2);
        else {
            handler = (this.collision_handler[tag2]||{})[tag1];
            if (handler) handler(o2, o1);
        }
    }
    tag(tag, obj) {
        obj.tags.push(tag)
    }
    onCollide(tag1, tag2, f) {
        this.collision_handler[tag1]||={};
        this.collision_handler[tag1][tag2]=f;
    }
}

$(document).ready(() => {
    let analyser, audioSource, audioCtx;
    const game = window.game = new Game();

    const red = window.red = game.add(Band, $(".band-red"), {
        colorf: random_color_red,
        audio: $("audio.band-red"),
        angularSpeed: 5,
        maxVolume: 0.25,
        team: "red",
        borderColor: (health) => { return `rgba(${health*255}, 5, 5, ${0.5+(health/2)})` },
    }, ["redBand"]);
    const blue = window.blue = game.add(Band, $(".band-blue"), { 
        colorf: random_color_blue,
        audio: $("audio.band-blue"),
        angularSpeed: -5,
        maxVolume: 1,
        team: "blue",
        borderColor: (health) => { return `rgba(5, 5, ${health*255}, ${0.5+(health/2)})` },
    }, ["blueBand"]);
    red.opponent = blue;
    blue.opponent = red;
    // Linked play/pause buttons
    red.audio.on("pause", () => { blue.audio[0].pause() });
    red.audio.on("play", () => { blue.audio[0].play() });
    blue.audio.on("pause", () => { red.audio[0].pause() });
    blue.audio.on("play", () => { red.audio[0].play() });
    // Should they take turns or play together

    const bandBullet = (band, bullet) => {
        game.blam(bullet, 30);
        bullet.destroy();
        band.damage(0.11);
    }
    const bulletBullet = (bullet1, bullet2) => {
        game.blam(bullet1, 10);
        bullet1.destroy();
        bullet2.destroy();
    }
    game.onCollide("redBand", "blueBullet", bandBullet);
    game.onCollide("blueBand", "redBullet", bandBullet);
    game.onCollide("redBullet", "blueBullet", bulletBullet);

    let animating = false;
    function _animate() {
        if (!animating) {
            animating = true;
            game.animate();
            animating = false;
        }
    }
    setInterval(_animate, 30);
});
