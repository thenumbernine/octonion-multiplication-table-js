var glutil;
var gl;

$(document).ready(function() {
	var canvas = $('#canvas').get(0);
	glutil = new GLUtil({canvas:canvas});
	gl = glutil.context;

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

void main() {
	vec3 screenCoord = fragToScreen(gl_FragCoord.xyz);
	vec3 s = dFdx(screenCoord);
	vec3 t = dFdy(screenCoord);
	vec3 n = normalize(cross(s, t));
	float l = max(n.z, .3);

	float u = texcoord.x;
	float v = texcoord.y;

	vec3 color = vec3(1., 0., 0.);

	// determine septant here
	
	float f = u * .5;
	if (gl_FrontFacing) f += .5;

	f = fract(f * mix(3., 4., v));

	const float thickness = .005;	//half of thickness
	if (-thickness < f && f < thickness) {
		gl_FragColor = vec4(0., 0., 0., 1.);
	} else if (-thickness < v - f && v - f < thickness) {
		gl_FragColor = vec4(0., 0., 0., 1.);
	} else if (v - f < 0.) {
		//going right this is the first lower right triangle
		gl_FragColor = vec4(l * vec3(f - v, 1. - f, v), 1.);
	} else {
		//going right this is the first upper left triangle
		gl_FragColor = vec4(l * vec3(1. - v, f, v - f), 1.);
	}
}
*/}),
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
			parent : mobiusStripObj
		});
	}

	var tmpQ = quat.create();
	var lastMouseRot = quat.create();
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
		zoom : function(dz) {
			glutil.view.fovY *= Math.exp(-.0003 * dz);
			glutil.view.fovY = Math.clamp(glutil.view.fovY, 1, 179);
			glutil.updateProjection();
			glutil.draw();
		}
	});

	update();
});

function update() {
	glutil.draw();
	requestAnimFrame(update);
}

