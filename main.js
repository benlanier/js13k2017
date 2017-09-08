(() => {

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

  throw "Invalid length for Translation";
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

let vertShader = `
attribute vec3 aVertexPosition;
attribute vec4 aVertexColor;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
varying lowp vec4 vColor;
void main(void) {
  gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
  vColor = aVertexColor;
}
`;

let fragShader = `
varying lowp vec4 vColor;
void main(void) {
  gl_FragColor = vColor;
}
`;

let imgVertShader = `
attribute vec3 aVertexPosition;
attribute vec2 aTextureCoord;
uniform mat4 uMVMatrix;
uniform mat4 uPMatrix;
varying highp vec2 vTextureCoord;
void main(void) {
  mat4 i = uMVMatrix;
  i[0][0] = 1.0;
  i[0][1] = 0.0;
  i[0][2] = 0.0;
  i[1][0] = 0.0;
  i[1][1] = -1.0;
  i[1][2] = 0.0;
  i[2][0] = 0.0;
  i[2][1] = 0.0;
  i[2][2] = 1.0;
  gl_Position = uPMatrix * i * vec4(aVertexPosition, 1.0);
  vTextureCoord = aTextureCoord;
}
`;
let imgFragShader = `
varying highp vec2 vTextureCoord;
uniform sampler2D uSampler;
void main(void) {
  gl_FragColor = texture2D(uSampler, vTextureCoord);
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

let uniformModelViewMatrix = gl.getUniformLocation(shader, "uMVMatrix");
let uniformProjectionMatrix = gl.getUniformLocation(shader, "uPMatrix");
// let uniformSampler = gl.getUniformLocation(shader, "uSampler");

let vertexPositionAttribute = gl.getAttribLocation(shader, "aVertexPosition");
gl.enableVertexAttribArray(vertexPositionAttribute);

let vertexColorAttribute = gl.getAttribLocation(shader, "aVertexColor");
gl.enableVertexAttribArray(vertexColorAttribute);

let iVertexPosAttr = gl.getAttribLocation(imgShader, 'aVertexPosition');
gl.enableVertexAttribArray(iVertexPosAttr);
let iTexCoordAttr = gl.getAttribLocation(imgShader, 'aTextureCoord');
gl.enableVertexAttribArray(iTexCoordAttr);
let iUMVMatrix = gl.getUniformLocation(imgShader, 'uMVMatrix');
let iUPMatrix = gl.getUniformLocation(imgShader, 'uPMatrix');

// let textureCoordAttribute = gl.getAttribLocation(shader, "aTextureCoord");
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
  if (!mvMatrixStack.length) {
    throw("Can't pop from an empty matrix stack.");
  }

  mvMatrix = mvMatrixStack.pop();
  return mvMatrix;
}

let perspectiveMatrix = makePerspective(120, c.width / c.height, 0.1, 1000.0);

function mvRotate(angle, v) {
//   var inRadians = angle * Math.PI / 180.0;

  var m = Matrix.Rotation(angle, $V([v[0], v[1], v[2]])).ensure4x4();
  multMatrix(m);
}


let vertexBuffer;
let colorBuffer;
let indexBuffer;
let mesh;

// const colors = Array(6).fill([0.0, 0.0, 1.0, 1.0]).reduce((a, b) => a.concat(b), []);
const colors = (() => { const x = [1,1,1,1,
                .7,.7,.7,1,
                1,1,1,1]; return x.concat(x); })();

const loadVColorModel = async (filename, colors) =>{
    const obj = await fetch(filename).then(r => r.text());
    console.log(obj);
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

Array.prototype.flatten = function() {
    return this.reduce((a,b)=>a.concat(b),[])
}

const loadBB = async () => {
    const img = new Image();
    img.width = 64;
    img.height = 128;
    const idata = new Promise(async (resolve) => {
        const t = await fetch('grass_out.svg').then(r=>r.text());
        img.src = 'data:image/svg+xml;base64,' + window.btoa(unescape(encodeURIComponent(t)));
        img.onload = () => {
            resolve(img);
        };
    });

    const [obj, loadedImg] = await Promise.all([fetch('texplane.obj').then(r=>r.text()), idata]);
    const mesh = parseObj(obj);
    console.log(loadedImg);
    
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
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, loadedImg);
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
let chaseCam = true;
let roll = 0;
let grav = $V([0, -0.001, 0]);
// let grav = $V([0,0,0]);
let a = $V([0, 0, 0]);
let v = $V([0, 0, -0.02]);
// let v = $V([0, 0, 0]);
let p = $V([0, 10, 0]);
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
});
let steering = false;
c.addEventListener('touchstart', (e) => {
    e.preventDefault();
    let t = e.touches[0];
    let [tx, ty] = [t.clientX, t.clientY];
    if (tx < 100 && ty < 100) {
        chaseCam = !chaseCam
        return;
    }
    // [startX, startY] = [rotX, rotY];
    steering = true;
})
c.addEventListener('touchend', (e) => {
    e.preventDefault();
    steering = false;
    [px, py] = [null, null];
})

const grassLocs = [];
for (let i = 0; i < 50; i++) {
    grassLocs.push([Math.random()*100 - 50, Math.random()*100, Math.random() < .5]);
}
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

function draw(ppObj, shadowObj, texObj, groundObj) {
    let heading = Vector.k.rotate(rotY,Line.X).rotate(rotX, Line.Y);
    if (!steering) {
        //rotX *= .95;
        rotY *= .95;
        roll *= .95;
    } else {
        // roll = heading.cross(Vector.k).e(2);
        roll = heading.cross(v.x(-1)).e(2) * 2;
    }

    a = heading.x(-.005).reflectionIn(Plane.YZ).add(grav);

    v = v.add(a);
    if (Math.hypot(v.e(1),v.e(2),v.e(3)) > 0.3) {
        v = v.toUnitVector().x(.3);
    }

    p = p.add(v);

    // p[0] += v[0]
    // p[1] += v[1]
    // p[2] += v[2]
    // rotX += Math.PI / 32;
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

    // mvTranslate([i+Math.sin(rotX)*-5, (-j-3) + Math.sin(rotY)*-10, -k-10]);
    if (chaseCam) { 
        let [bx, by, bz] = p.add(heading.x(10).reflectionIn(Plane.YZ)).elements;
        multMatrix(makeLookAt(bx, by+3, bz, p.e(1), p.e(2), p.e(3), 0, 1, 0));
    } else {
    multMatrix(makeLookAt(30, 30, -10, p.e(1), p.e(2), p.e(3), 0, 1, 0));
    }
    // mvTranslate(p.subtract(v.x(-100)).elements);
    // mvRotate(Math.PI, [0,1,0]);

    // objects

    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            mvPushMatrix();
            mvTranslate([0+i*100,-2,-80+j*100]);
            drawColorObj(groundObj);
            mvPopMatrix();
        }
    }

    mvPushMatrix();
    mvTranslate([i,-1.95,k]);
    mvRotate(-rotX, [0,1,0]);
    // mvRotate(roll, [0,0,1]);
    // mvRotate(rotY + (Math.PI/16), [1,0,0]);
    multMatrix(Matrix.Diagonal([1,0,1,1]));
    // mvRotate(, [0,0,1]);
    drawColorObj(shadowObj);
    mvPopMatrix();



    mvPushMatrix();
    mvTranslate([i,j,k]);
    mvRotate(-rotX, [0,1,0]);
    mvRotate(roll, [0,0,1]);
    mvRotate(rotY + (Math.PI/16), [1,0,0]);
    // mvRotate(, [0,0,1]);
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
    gl.uniform1i(gl.getUniformLocation(imgShader, 'uSampler'), 0);

    grassLocs.forEach(([x, y, flip]) => {
        mvPushMatrix();
        mvTranslate([x,0,-y]);
        mvRotate(Math.PI,[1,0,0]);
        if (flip) {
            mvRotate(Math.PI,[0,1,0]);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, texObj.indexBuffer);
        gl.uniformMatrix4fv(iUPMatrix, false, new Float32Array(perspectiveMatrix.flatten()));
        gl.uniformMatrix4fv(iUMVMatrix, false, new Float32Array(mvMatrix.flatten()));
        gl.drawElements(gl.TRIANGLES, texObj.indices.length, gl.UNSIGNED_SHORT, 0);
        mvPopMatrix();
    });
    

    mvPopMatrix();

    requestAnimationFrame(draw.bind(this, ppObj, shadowObj, texObj, groundObj));
}

Promise.all([
    loadVColorModel('pplane.obj', colors),
    loadVColorModel('pplane.obj', colors.map((e,i)=>i%4==3?0.5:0)),
    loadBB(),
    loadVColorModel('groundplane.obj', Array(4).fill([0,0.5,0,1]).flatten())
]).then(([pp, shadow, bt, grnd]) => draw(pp, shadow, bt, grnd));

})();
