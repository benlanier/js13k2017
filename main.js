(async () => {

Array.prototype.flatten = function() {
    return this.reduce((a,b)=>a.concat(b),[])
}

Matrix.Translation = (v) => {
  if (v.elements.length == 2) {
    let r = Matrix.I(3);
    [r.elements[2][0],r.elements[2][1]] = [v.elements[0],v.elements[1]];
    return r;
  }

  if (v.elements.length == 3) {
    let r = Matrix.I(4);
    [r.elements[0][3],r.elements[1][3],r.elements[2][3]] = [v.elements[0],v.elements[1],v.elements[2]];
    return r;
  }
}

Matrix.prototype.flatten = function ()
{
    var result = [];
    if (this.elements.length == 0)
        return [];

    for (var j = 0; j < this.elements[0].length; j++)
        for (var i = 0; i < this.elements.length; i++)
            result.push(this.elements[i][j]);
    return result;
}

var parseObj = (objectData) => {
    var verts = [], vertNormals = [], textures = [], unpacked = {
        verts:[],
        norms:[],
        textures:[],
        hashindices:[],
        indices:[],
        index:0
    },
    lines = objectData.split('\n'),
    VERTEX_RE = /^v\s/,
    NORMAL_RE = /^vn\s/,
    TEXTURE_RE = /^vt\s/,
    FACE_RE = /^f\s/,
    WHITESPACE_RE = /\s+/;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      var elements = line.split(WHITESPACE_RE);
      elements.shift();

      if (VERTEX_RE.test(line)) {
        // if this is a vertex
        verts.push.apply(verts, elements);
      } else if (NORMAL_RE.test(line)) {
        // if this is a vertex normal
        vertNormals.push.apply(vertNormals, elements);
      } else if (TEXTURE_RE.test(line)) {
        // if this is a texture
        textures.push.apply(textures, elements);
      } else if (FACE_RE.test(line)) {
        var quad = false;
        for (var j = 0, eleLen = elements.length; j < eleLen; j++){
            if(j === 3 && !quad) {
                j = 2;
                quad = true;
            }
            if(elements[j] in unpacked.hashindices){
                unpacked.indices.push(unpacked.hashindices[elements[j]]);
            }
            else{
                /*
                Each element of the face line array is a vertex which has its
                attributes delimited by a forward slash. This will separate
                each attribute into another array:
                    '19/92/11'
                becomes:
                    vertex = ['19', '92', '11'];
                where
                    vertex[0] is the vertex index
                    vertex[1] is the texture index
                    vertex[2] is the normal index
                 Think of faces having Vertices which are comprised of the
                 attributes location (v), texture (vt), and normal (vn).
                 */
                var vertex = elements[ j ].split( '/' );
                /*
                 The verts, textures, and vertNormals arrays each contain a
                 flattend array of coordinates.

                 Because it gets confusing by referring to vertex and then
                 vertex (both are different in my descriptions) I will explain
                 what's going on using the vertexNormals array:

                 vertex[2] will contain the one-based index of the vertexNormals
                 section (vn). One is subtracted from this index number to play
                 nice with javascript's zero-based array indexing.

                 Because vertexNormal is a flattened array of x, y, z values,
                 simple pointer arithmetic is used to skip to the start of the
                 vertexNormal, then the offset is added to get the correct
                 component: +0 is x, +1 is y, +2 is z.

                 This same process is repeated for verts and textures.
                 */
                // vertex position
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 0]);
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 1]);
                unpacked.verts.push(+verts[(vertex[0] - 1) * 3 + 2]);
                // vertex textures
                if (textures.length) {
                  unpacked.textures.push(+textures[(vertex[1] - 1) * 2 + 0]);
                  unpacked.textures.push(+textures[(vertex[1] - 1) * 2 + 1]);
                }
                // vertex normals
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 0]);
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 1]);
                unpacked.norms.push(+vertNormals[(vertex[2] - 1) * 3 + 2]);
                // add the newly created vertex to the list of indices
                unpacked.hashindices[elements[j]] = unpacked.index;
                unpacked.indices.push(unpacked.index);
                // increment the counter
                unpacked.index += 1;
            }
            if(j === 3 && quad) {
                // add v0/t0/vn0 onto the second triangle
                unpacked.indices.push( unpacked.hashindices[elements[0]]);
            }
        }
      }
    }
    return {
        vertices: unpacked.verts,
        vertexNormals: unpacked.norms,
        textures: unpacked.textures,
        indices: unpacked.indices
    }
}

let c = document.getElementById('c');
[c.width, c.height] = [window.innerWidth, window.innerHeight];
let gl = c.getContext('webgl');
gl.clearColor(0.39,0.81,0.95,1.0);
gl.clearDepth(1.0);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);

let sPrefix = `
attribute vec3 avp;
uniform mat4 mvm;
uniform mat4 pm;
`;

let vertShader = `
${sPrefix}
attribute vec4 c;
varying lowp vec4 v;
void main(void) {
  gl_Position = pm * mvm * vec4(avp, 1.0);
  v = c;
}
`;

let fragShader = `
varying lowp vec4 v;
void main(void) {
  gl_FragColor = v;
}
`;

let imgVertShader = `
${sPrefix}
attribute vec2 tc;
varying highp vec2 v;
void main(void) {
  mat4 i = mvm;
  i[0][0] = 1.0;
  i[0][1] = 0.0;
  i[0][2] = 0.0;
  i[1][0] = 0.0;
  i[1][1] = -1.0;
  i[1][2] = 0.0;
  i[2][0] = 0.0;
  i[2][1] = 0.0;
  i[2][2] = 1.0;
  gl_Position = pm * i * vec4(avp, 1.0);
  v = tc;
}
`;
let imgFragShader = `
varying highp vec2 v;
uniform sampler2D uS;
void main(void) {
  gl_FragColor = texture2D(uS, v);
  if (gl_FragColor.a < 0.4) discard;
}
`;

let makeShader = (vSource, fSource) => {
    let vShader = gl.createShader(gl.VERTEX_SHADER),
        fShader = gl.createShader(gl.FRAGMENT_SHADER),
        shader = gl.createProgram();
    gl.shaderSource(vShader, vSource);
    gl.compileShader(vShader);

    gl.shaderSource(fShader, fSource);
    gl.compileShader(fShader);

    gl.attachShader(shader, vShader);
    gl.attachShader(shader, fShader);
    gl.linkProgram(shader);
    return shader;
}

let shader = makeShader(vertShader, fragShader),
    imgShader = makeShader(imgVertShader, imgFragShader);

let uniformModelViewMatrix = gl.getUniformLocation(shader, "mvm");
let uniformProjectionMatrix = gl.getUniformLocation(shader, "pm");
// let uniformSampler = gl.getUniformLocation(shader, "uS");

let vertexPositionAttribute = gl.getAttribLocation(shader, "avp");
gl.enableVertexAttribArray(vertexPositionAttribute);

let vertexColorAttribute = gl.getAttribLocation(shader, "c");
gl.enableVertexAttribArray(vertexColorAttribute);

let iVertexPosAttr = gl.getAttribLocation(imgShader, 'avp');
gl.enableVertexAttribArray(iVertexPosAttr);
let iTexCoordAttr = gl.getAttribLocation(imgShader, 'tc');
gl.enableVertexAttribArray(iTexCoordAttr);
let iUMVMatrix = gl.getUniformLocation(imgShader, 'mvm');
let iUPMatrix = gl.getUniformLocation(imgShader, 'pm');

let iSamp = gl.getUniformLocation(imgShader, 'uS');
// let textureCoordAttribute = gl.getAttribLocation(shader, "tc");
// gl.enableVertexAttribArray(textureCoordAttribute);


function makeFrustum(left, right,
                     bottom, top,
                     znear, zfar)
{
    var X = 2*znear/(right-left);
    var Y = 2*znear/(top-bottom);
    var A = (right+left)/(right-left);
    var B = (top+bottom)/(top-bottom);
    var C = -(zfar+znear)/(zfar-znear);
    var D = -2*zfar*znear/(zfar-znear);

    return $M([[X, 0, A, 0],
               [0, Y, B, 0],
               [0, 0, C, D],
               [0, 0, -1, 0]]);
}

function makeLookAt(ex, ey, ez,
                    cx, cy, cz,
                    ux, uy, uz)
{
    var eye = $V([ex, ey, ez]);
    var center = $V([cx, cy, cz]);
    var up = $V([ux, uy, uz]);

    var mag;

    var z = eye.subtract(center).toUnitVector();
    var x = up.cross(z).toUnitVector();
    var y = z.cross(x).toUnitVector();

    var m = $M([[x.e(1), x.e(2), x.e(3), 0],
                [y.e(1), y.e(2), y.e(3), 0],
                [z.e(1), z.e(2), z.e(3), 0],
                [0, 0, 0, 1]]);

    var t = $M([[1, 0, 0, -ex],
                [0, 1, 0, -ey],
                [0, 0, 1, -ez],
                [0, 0, 0, 1]]);
    return m.x(t);
}

function makePerspective(fovy, aspect, znear, zfar)
{
    var ymax = znear * Math.tan(fovy * Math.PI / 360.0);
    var ymin = -ymax;
    var xmin = ymin * aspect;
    var xmax = ymax * aspect;

    return makeFrustum(xmin, xmax, ymin, ymax, znear, zfar);
}

Matrix.prototype.ensure4x4 = function()
{
    if (this.elements.length == 4 &&
        this.elements[0].length == 4)
        return this;

    if (this.elements.length > 4 ||
        this.elements[0].length > 4)
        return null;

    for (var i = 0; i < this.elements.length; i++) {
        for (var j = this.elements[i].length; j < 4; j++) {
            if (i == j)
                this.elements[i].push(1);
            else
                this.elements[i].push(0);
        }
    }

    for (var i = this.elements.length; i < 4; i++) {
        if (i == 0)
            this.elements.push([1, 0, 0, 0]);
        else if (i == 1)
            this.elements.push([0, 1, 0, 0]);
        else if (i == 2)
            this.elements.push([0, 0, 1, 0]);
        else if (i == 3)
            this.elements.push([0, 0, 0, 1]);
    }

    return this;
};

let mvMatrix;

function loadIdentity() {
  mvMatrix = Matrix.I(4);
}

function multMatrix(m) {
  mvMatrix = mvMatrix.x(m);
}

function mvTranslate(v) {
  multMatrix(Matrix.Translation($V([v[0], v[1], v[2]])).ensure4x4());
}


const mvMatrixStack = [];
function mvPushMatrix(m) {
  if (m) {
    mvMatrixStack.push(m.dup());
    mvMatrix = m.dup();
  } else {
    mvMatrixStack.push(mvMatrix.dup());
  }
}

function mvPopMatrix() {
  mvMatrix = mvMatrixStack.pop();
}

let perspectiveMatrix = makePerspective(120, c.width / c.height, 0.1, 1000.0);

function mvRotate(angle, v) {
  multMatrix(Matrix.Rotation(angle, $V([v[0], v[1], v[2]])).ensure4x4());
}


let vertexBuffer;
let colorBuffer;
let indexBuffer;
let mesh;

// const colors = Array(6).fill([0.0, 0.0, 1.0, 1.0]).reduce((a, b) => a.concat(b), []);
const colors = Array(2).fill(0).map(_=>[1,1,1,1,
    .7,.7,.7,1,
    1,1,1,1]).flatten();

const loadVColorModel = async (filename, colors) =>{
    const obj = await fetch(filename).then(r => r.text());
    const mesh = parseObj(obj);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
    
    return {
        vertexBuffer,
        indexBuffer,
        colorBuffer,
        indices: mesh.indices
    };
}


let makeIsland = () => {
    let segments = Math.floor(Math.random()*20)+3;
    let r = 150;
    let isPts = Array(segments).fill(0).map((e,i)=>[
        Math.cos(i*2*Math.PI/segments)*r*Math.max(Math.random(),.5),
        0.0,
        Math.sin(i*2*Math.PI/segments)*r*Math.max(Math.random(),.5)]);
    isPts.unshift([0,0,0]);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(isPts.flatten()), gl.STATIC_DRAW);

    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(isPts.map((x,i)=>i==0?[0,.4,0,1]:[0.8,0.5,0,1.0]).flatten()), gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    let is = Array(isPts.length).fill(0).map((e,i)=>i);
    is.push(1);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(is), gl.STATIC_DRAW);

    return {
        vertexBuffer,
        colorBuffer,
        indexBuffer,
        indices: isPts
    };
}

let drawIsland = (o) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, o.colorBuffer);
    gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);
    gl.uniformMatrix4fv(uniformProjectionMatrix, false, new Float32Array(perspectiveMatrix.flatten()));
    gl.uniformMatrix4fv(uniformModelViewMatrix, false, new Float32Array(mvMatrix.flatten()));
    gl.drawElements(gl.TRIANGLE_FAN, o.indices.length+1, gl.UNSIGNED_SHORT, 0);
}


const loadBB = async (path, slot) => {
    const img = new Image();
    img.width = 256;
    img.height = 512;
    const idata = new Promise(async (resolve) => {
        img.src = path;
        img.onload = () => {
            resolve(img);
        };
    });

    let res = await Promise.all([fetch('texplane.obj').then(r=>r.text()), idata]);
    const mesh = parseObj(res[0]);
    
    const vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.vertices), gl.STATIC_DRAW);

    const tcBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tcBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.textures), gl.STATIC_DRAW);

    const iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);

    const texture = gl.createTexture();
    gl.activeTexture(slot);
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, res[1]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return {
        verticesBuffer: vBuffer,
        textureBuffer: tcBuffer,
        indexBuffer: iBuffer,
        texture: texture,
        indices: mesh.indices
    };
}



let [px, py] = [null, null];
let rotX = 0;
let rotY = 0;
let startX = null;
let startY = null;
let roll = 0;
let grav = $V([0, -0.001, 0]);
// let grav = $V([0,0,0]);
let a = $V([0, 0, 0]);
let v = $V([0, 0, -0.02]);
// let v = $V([0, 0, 0]);

let p;
{
    let t = Math.random()*Math.PI*2;
    let r = Math.random()*900+500;
    // p= $V([Math.cos(t)*r, 30, Math.sin(t)*r]);
    p = $V([20,20,20]);
}
let [tx0,tx1] = [0,0];
c.addEventListener('touchmove', (e) => {
    e.preventDefault();
    let t = e.touches[0];
    let [tx, ty] = [t.clientX, t.clientY];
    if (px === null) {
        [px, py] = [tx, ty];
        return;
    }
    let dx = tx - px;
    let dy = ty - py;
    rotX += dx / c.width * 4;
    rotY += dy / c.height * 4;
    [px, py] = [tx, ty];
    tx1 = tx;
});
let steering = false;
c.addEventListener('touchstart', (e) => {
    e.preventDefault();
    let t = e.touches[0];
    let [tx, ty] = [t.clientX, t.clientY];
    // [startX, startY] = [rotX, rotY];
    steering = true;
    tx0 = tx;
})
c.addEventListener('touchend', (e) => {
    e.preventDefault();
    steering = false;
    [px, py] = [null, null];
})

Vector.prototype.len = function () {
    return Math.hypot.apply(this, this.elements);
}

let wavePs = [];
let pwaveP = null;
let drawColorObj = (o) => {
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vertexBuffer);
    gl.vertexAttribPointer(vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, o.colorBuffer);
    gl.vertexAttribPointer(vertexColorAttribute, 4, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);
    gl.uniformMatrix4fv(uniformProjectionMatrix, false, new Float32Array(perspectiveMatrix.flatten()));
    gl.uniformMatrix4fv(uniformModelViewMatrix, false, new Float32Array(mvMatrix.flatten()));
    gl.drawElements(gl.TRIANGLES, o.indices.length, gl.UNSIGNED_SHORT, 0);
}

const island = makeIsland();

let drawBB = (to) => {
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, to.indexBuffer);
    gl.uniformMatrix4fv(iUPMatrix, false, new Float32Array(perspectiveMatrix.flatten()));
    gl.uniformMatrix4fv(iUMVMatrix, false, new Float32Array(mvMatrix.flatten()));
    gl.drawElements(gl.TRIANGLES, to.indices.length, gl.UNSIGNED_SHORT, 0);
}

const mansP = $V([20,-13,0]);

function draw(ppObj, shadowObj, texObj, treeObj, mansObj, groundObj) {
    let heading = Vector.k.rotate(rotY,Line.X).rotate(rotX, Line.Y);
    a = heading.x(-.005).reflectionIn(Plane.YZ).add(grav);
    let at = Math.atan2(v.e(3),v.e(1));
    roll = -((rotX-Math.PI/2)-at);
    if (!steering) {
        rotY *= .95;
    }
    
    v = v.add(a);
    if (Math.hypot(v.e(1),v.e(2),v.e(3)) > 0.3) {
        v = v.toUnitVector().x(.3);
    }

    p = p.add(v);
    
    if (p.add(mansP.x(-1)).len() < 20) { win(); return; }
    else if (p.e(2) < 0 && Math.hypot(p.e(1),p.e(3))>100) { lose(); return; }
    
    if (p.e(1) < -1500 || p.e(1) > 1500 || p.e(3) < -1500 || p.e(3) > 1500) {p = p.x(0.95); p = p.rotate(Math.PI,Line.Y)}

    if (pwaveP==null||p.subtract(pwaveP).len() > 100) {
        wavePs = Array(50).fill(0).map(_=>[p.e(1)+Math.random()*500-250, p.e(3)+Math.random()*500-250]);
        pwaveP = p.dup();
    }

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(shader);
    loadIdentity();
    // camera position here
    let [i,j,k] = p.elements;

    if (j < -.5) {
        p.setElements([i,-.5,k]);
        j = -.5;
        v = v.reflectionIn(Plane.XZ);
    }

    let [bx, by, bz] = p.add(heading.x(10).reflectionIn(Plane.YZ)).elements;
    multMatrix(makeLookAt(bx, by+3, bz, p.e(1), p.e(2), p.e(3), 0, 1, 0));
    // objects

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            mvPushMatrix();
            // mvTranslate([0+i*100,-3.1,-80+j*100]);
            mvTranslate([0,-3,0])
            multMatrix(Matrix.Diagonal([20,1,20,1]))
            drawColorObj(groundObj);
            mvPopMatrix();
        }
    }

    mvPushMatrix();
    mvTranslate([0,-2,0]);
    drawIsland(island);
    mvPopMatrix();

    mvPushMatrix();
    mvTranslate([i,-1.95,k]);
    mvRotate(-rotX, [0,1,0]);
    multMatrix(Matrix.Diagonal([1,0,1,1]));
    mvRotate(roll, [0,0,1]);
    mvRotate(rotY + (Math.PI/16), [1,0,0]);
    // mvRotate(, [0,0,1]);
    drawColorObj(shadowObj);
    mvPopMatrix();



    mvPushMatrix();
    mvTranslate([i,j,k]);
    mvRotate(-rotX, [0,1,0]);
    mvRotate(roll, [0,0,1]);
    mvRotate(rotY + (Math.PI/16), [1,0,0]);
    drawColorObj(ppObj);
    mvPopMatrix();


    mvPushMatrix();
    
    gl.useProgram(imgShader);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, texObj.verticesBuffer);
    gl.vertexAttribPointer(iVertexPosAttr, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texObj.textureBuffer);
    gl.vertexAttribPointer(iTexCoordAttr, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texObj.texture);
    gl.uniform1i(iSamp, 0);

    wavePs.forEach(([x, y]) => {
        mvPushMatrix();
        mvTranslate([x,4.5,y]);
        mvRotate(Math.PI,[1,0,0]);
        multMatrix(1/4);
        drawBB(texObj);
        mvPopMatrix();
    });

    mvPushMatrix();
    mvRotate(Math.PI,[1,0,0]);
    gl.uniform1i(iSamp, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, treeObj.texture);
    mvTranslate([0,-17,0]);
    multMatrix(1/10);
    drawBB(treeObj);
    mvPopMatrix();

    mvPushMatrix();
    mvRotate(Math.PI,[1,0,0]);
    gl.uniform1i(iSamp, 2);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, mansObj.texture);
    mvTranslate(mansP.elements);
    multMatrix(1/8);
    drawBB(mansObj);

    mvPopMatrix();

    requestAnimationFrame(draw.bind(this, ppObj, shadowObj, texObj, treeObj, mansObj, groundObj));
}

let startTime;
Promise.all([
    loadVColorModel('pplane.obj', colors),
    loadVColorModel('pplane.obj', colors.map((e,i)=>i%4==3?0.8:0)),
    loadBB('wave.png', gl.TEXTURE0),
    loadBB('tree.png', gl.TEXTURE1),
    loadBB('sos.svg', gl.TEXTURE2),
    loadVColorModel('groundplane.obj', Array(4).fill([0,0,0.5,1]).flatten())
]).then(([pp, shadow, bt, tree, mans, grnd]) => {startTime=new Date();draw(pp, shadow, bt, tree, mans, grnd)});

let sett = (t) => document.getElementById('res').innerText=`time: ${Math.round((new Date() - t)/1000)-2}s`;
function win() {
    document.body.style.backgroundColor="#ebb200";
    c.style.opacity = 0;
    setTimeout(() => {document.querySelectorAll('svg').forEach(e=>{e.style.width=c.width;e.style.display="block"});
    document.querySelectorAll('.lose').forEach(e=>e.style.display="none");sett(startTime);}, 2000);
    
}

function lose() {
    document.body.style.backgroundColor="#000080";
    c.style.opacity = 0;
    setTimeout(() => {document.querySelectorAll('svg').forEach(e=>{e.style.width=c.width;e.style.display="block"});
    document.getElementById('win').style.display="none";sett(startTime);}, 2000);
}

})();
