var glutil;
var gl;

$(document).ready(function() {
	var canvas = $('#canvas').get(0);
	glutil = new GLUtil({canvas:canvas});
	gl = glutil.context;

	var textTex;
	(function(){
		var textureCanvas = $('<canvas>')
			.appendTo(document.body)
			.get(0);
		var textWidth = 64;
		var textHeight = 64;
		var repWidth = 4;
		var repHeight = 2;
		textureCanvas.width = textWidth * repWidth;
		textureCanvas.height = textHeight * repHeight;
		var ctx = textureCanvas.getContext('2d');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
		ctx.fillStyle = '#000000';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		var e = 0;
		//Cayley-Dickson construction in modulo order is e1,e2,e5,e3,e7,e6,-e4
		//alternating every-other-one is the following:
		var indexes = [1,5,7,-4,2,3,6,0];
		for (var j = 0; j < repHeight; ++j) {
			for (var i = 0; i < repWidth; ++i) {
				ctx.font = '64px monospace';
				ctx.fillText('e', (i + .4) * textWidth, (j + .4) * textHeight - 8);
				ctx.font = '32px monospace';
				ctx.fillText(indexes[e], (i + .75) * textWidth, (j + .8) * textHeight - 8);
				++e;
			}
		}
	
		textTex = new glutil.Texture2D({
			level : 0,
			internalFormat : gl.RGBA,
			format : gl.RGBA,
			type : gl.UNSIGNED_BYTE,
			data : ctx.canvas,
			minFilter : gl.LINEAR_MIPMAP_LINEAR,
			magFilter : gl.LINEAR,
			generateMipmap : true,
		});
		
		$(textureCanvas).remove();
	})();

	gl.clearColor(1,1,1,1);
	gl.enable(gl.DEPTH_TEST);

	glutil.view.pos[2] = 2;
	glutil.view.zNear = .1;
	glutil.view.zFar = 100;
	glutil.updateProjection();

	var shader = new glutil.ShaderProgram({
		vertexPrecision : 'best',
		vertexCode : mlstr(function(){/*
attribute vec2 vertex;
uniform mat4 mvMat, projMat;
varying vec2 texcoord;

vec3 quatRotate(vec4 q, vec3 v){
	return v + 2. * cross(cross(v, q.xyz) - q.w * v, q.xyz);
}

//assumes axis is normalized
vec4 angleAxisToQuat(vec3 axis, float theta) {
	float vlen = length(axis);
	float costh = cos(.5 * theta);
	float sinth = sin(.5 * theta);
	float vscale = sinth / vlen;
	return vec4(axis * vscale, costh);
}

vec3 vecRotate(vec3 v, float x, float y, float z, float theta) {
	return quatRotate(angleAxisToQuat(vec3(x,y,z), theta), v);
}

void main() {
	texcoord = vertex;
	float u = vertex.x;
	float v = vertex.y;
	vec3 r = vec3(0., 0., v - .5);
	r = vecRotate(r, 0., 1., 0., radians(180. * u));
	r += vec3(1., 0., 0.);
	r = vecRotate(r, 0., 0., 1., radians(360. * u));
	gl_Position = projMat * mvMat * vec4(r, 1.);
}
*/}),
		fragmentPrecision : 'best',
		fragmentCode : mlstr(function(){/*
#extension GL_OES_standard_derivatives : enable
varying vec2 texcoord;

//https://www.opengl.org/discussion_boards/showthread.php/164734-Deferred-shading?p=1164077#post1164077

const vec2 bufferSize = vec2(800., 600.);
const vec2 cameraRange = vec2(.1, 100.);

float depthToZPosition(in float depth) {
	return cameraRange.x / (cameraRange.y - depth *
		(cameraRange.y - cameraRange.x)) * cameraRange.y;
}

vec3 fragToScreen(vec3 fragCoord) {
	vec3 screenCoord = vec3(
		((fragCoord.x / bufferSize.x) - .5) * 2.,
		((-fragCoord.y / bufferSize.y) + .5) * 2. / (bufferSize.x / bufferSize.y),
		depthToZPosition(fragCoord.z));
	screenCoord.x *= screenCoord.z;
	screenCoord.y *= -screenCoord.z;
	return screenCoord;
}

#if 0
//  (0,1)
//       +---+---+
//       |\_               <- upper 1: y-1 = (0-1)/(3/2-0)(x-0) <=> y = 1 - 2*x/3
//       |\ \_     
//       | |  \            <- lower line: y-1 = (0-1)/(1/2-0)(x-0) <=> y = 1 - 2*x
//       +-+---+---+
//  (0,0)  ^   ^
//     (1/2,0) |
//           (3/2,0)
#endif

uniform float offset;

uniform sampler2D textTex;

float mod1(float x) { return x - floor(x); }

void main() {
	float u = texcoord.x;
	float v = texcoord.y;

	// determine septant here
	
	u *= .5;
	if (gl_FrontFacing) {
		u += .5;
		v = 1. - v;
	}
	u = mod1(u - offset);
	u = u * 7.;

	{
		vec2 tc;
		float len;
		float letter;
		vec2 letterOffset;
		
		letter = floor(mod1(u/7.)*7.);
		letterOffset = vec2(mod(letter, 4.) * .25, floor(letter / 4.) * .5);
		tc = 5. * vec2(3./2. * mod1(u + .5 / 5. * 2. / 3.), v);
		len = length(tc-.5)/.5;
		if (len <= 1.) {
			if (len <= .95) {
				tc.x = 1. - tc.x;
				gl_FragColor = texture2D(textTex, tc * vec2(.25, .5) + letterOffset);
			} else { 
				gl_FragColor = vec4(0.);
			}
			return;
		}
		
		letter = floor(mod1((u+3.)/7.)*7.);
		letterOffset = vec2(mod(letter, 4.) * .25, floor(letter / 4.) * .5);
		tc = 5. * vec2(3./2. * mod1(u - .5 + .5 / 5. * 2. / 3.), v - .8);
		len = length(tc-.5)/.5;
		if (len <= 1.) {
			if (len <= .95) {
				tc.x = 1. - tc.x;
				gl_FragColor = texture2D(textTex, tc * vec2(.25, .5) + letterOffset);
			} else {
				gl_FragColor = vec4(0.);
			}
			return;
		}
	}

	float ix = floor(3./2.*v + u);
	float iy = floor(.5 * v + u);
	float ic = mod1(.5 * (ix + iy));

	if (ic == 0.) {
		gl_FragColor = vec4(1., 0., 0., 1.);
	} else {
		discard;//gl_FragColor = vec4(0., 1., 0., 1.);
	}

	//apply diffuse lighting
	vec3 screenCoord = fragToScreen(gl_FragCoord.xyz);
	vec3 s = dFdx(screenCoord);
	vec3 t = dFdy(screenCoord);
	vec3 n = normalize(cross(s, t));
	float l = max(n.z, .3);
	gl_FragColor *= l;
}
*/}),
		uniforms : {
			offset : 0,
			textTex : 0
		},
	});

	var xRes = 200;
	var yRes = 10;
	var vertexBufferData = new Float32Array(2 * xRes * yRes);
	var e = 0;
	for (var j = 0; j < yRes; ++j) {
		for (var i = 0; i < xRes; ++i) {
			vertexBufferData[e++] = i/(xRes-1);
			vertexBufferData[e++] = j/(yRes-1);
		}
	}

	var vertexBuffer = new glutil.ArrayBuffer({
		dim : 2,
		data : vertexBufferData,
	});

	var s = Math.sqrt(.5);
	var mobiusStripObj = new glutil.SceneObject({
		pos : [0,0,0],
		angle : quat.mul([], [0,-s,0,s], [s,0,0,s]),
		static : false
	});

	for (var j = 0; j < yRes-1; ++j) {
		var indexes = [];
		for (var i = 0; i < xRes; ++i) {
			for (var ofs = 0; ofs < 2; ++ofs) {
				indexes.push(i + xRes * (j + ofs));
			}
		}
		new glutil.SceneObject({
			mode : gl.TRIANGLE_STRIP,
			indexes : new glutil.ElementArrayBuffer({data:indexes}),
			shader : shader,
			attrs : {
				vertex : vertexBuffer,
			},
			texs : [textTex],
			parent : mobiusStripObj
		});
	}

	var tmpQ = quat.create();
	var lastMouseRot = quat.create();
	var offset = 0;
	mouse = new Mouse3D({
		pressObj : canvas,
		move : function(dx,dy) {
			var rotAngle = -Math.PI / 180 * .1 * Math.sqrt(dx*dx + dy*dy);
			quat.setAxisAngle(tmpQ, [-dy, -dx, 0], rotAngle);
			
			quat.mul(lastMouseRot, glutil.view.angle, tmpQ);
			quat.conjugate(tmpQ, glutil.view.angle);
			quat.mul(lastMouseRot, lastMouseRot, tmpQ);

			quat.mul(mobiusStripObj.angle, lastMouseRot, mobiusStripObj.angle);
			quat.normalize(mobiusStripObj.angle, mobiusStripObj.angle);
			
			glutil.draw();
		},
		zoom : function(dz, method) {
			offset += .0001 * dz;
			if (method == 'wheel') {
				$.each(mobiusStripObj.children, function(i,child) {
					child.uniforms.offset = offset;
					child.uniforms.textTex = 0;
				});
			} else {	//click+drag?
				glutil.view.fovY *= Math.exp(-.0003 * dz);
				glutil.view.fovY = Math.clamp(glutil.view.fovY, 1, 179);
				glutil.updateProjection();
			}
			glutil.draw();
		}
	});

	update();
});

function update() {
	glutil.draw();
	requestAnimFrame(update);
}

