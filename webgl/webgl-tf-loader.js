// Copyright (c) 2012, Motorola Mobility, Inc.
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//  * Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//  * Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//  * Neither the name of the Motorola Mobility, Inc. nor the names of its
//    contributors may be used to endorse or promote products derived from this
//    software without specific prior written permission.
//
//  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
// THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

/*
    The Abstract Loader has two modes:
        #1: [static] load all the JSON at once [as of now]
        #2: [stream] stream and parse JSON progressively [not yet supported]

    Whatever is the mechanism used to parse the JSON (#1 or #2),
    The loader starts by resolving the paths to binaries and referenced json files (by replace the value of the path property with an absolute path if it was relative).

    In case #1: it is guaranteed to call the concrete loader implementation methods in a order that solves the dependencies between the entries.
    only the nodes requires an extra pass to set up the hirerarchy.
    In case #2: the concrete implementation will have to solve the dependencies. no order is guaranteed.

    When case #1 is used the followed dependency order is:

    scenes -> nodes -> meshes -> materials -> techniques -> shaders
                    -> buffers
                    -> cameras
                    -> lights

    The readers starts with the leafs, i.e:
        shaders, techniques, materials, meshes, buffers, cameras, lights, nodes, scenes

    For each called handle method called the client should return true if the next handle can be call right after returning,
    or false if a callback on client side will notify the loader that the next handle method can be called.

*/
var global = window;
(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory(global);
        module.exports.WebGLTFLoader = module.exports;
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], function () {
            return factory(root);
        });
    } else {
        // Browser globals
        factory(root);
    }
}(this, function (root) {
    "use strict";

    //to be refined as a tree. in that case, asking for nodes or scenes (most common case) will be fine, but asking for light will trigger unexpected callback (that will be no-op on client side, but could be avoided...)
    var categoriesDepsOrder = ["buffers", "shaders", "techniques", "materials", "meshes", "cameras", "lights", "nodes", "scenes"];

    var categoryForType = {
        "buffer" : "buffers",
        "shader" : "shaders",
        "technique" : "techniques",
        "material" : "materials",
        "mesh" : "meshes",
        "camera" : "cameras",
        "light" : "lights",
        "node" : "nodes",
        "scene" : "scenes"
    };

    var typeForCategory = {
        "buffers" : "buffer",
        "shaders" : "shader",
        "techniques" : "technique",
        "materials" : "material",
        "meshes" : "mesh",
        "cameras" : "camera",
        "lights" : "light",
        "nodes" : "node",
        "scenes" : "scene"
    };

    var WebGLTFLoader = Object.create(Object.prototype, {

        MESH: { value: "mesh" },
        MATERIAL: { value: "material" },
        TECHNIQUE: { value: "technique" },
        SHADER: { value: "shader" },
        SCENE: { value: "scene" },
        NODE: { value: "node" },
        CAMERA: { value: "camera" },
        VERTEX_ATTRIBUTES: { value: "vertexAttributes" },
        TYPE: { value: "type" },
        BUFFER : { value: "buffer" },

        _rootDescription: { value: null, writable: true },

        rootDescription: {
            set: function(value) {
                this._rootDescription = value;
            },
            get: function() {
                return this._rootDescription;
            }
        },

        baseURL: { value: null, writable: true },

        //detect absolute path following the same protocol than window.location
        _isAbsolutePath: {
            value: function(path) {
                var isAbsolutePathRegExp = new RegExp("^"+window.location.protocol, "i");

                return path.match(isAbsolutePathRegExp) ? true : false;
            }
        },

        resolvePathIfNeeded: {
            value: function(path) {
                if (this._isAbsolutePath(path)) {
                    return path;
                } else {
                    var pathComponents = path.split("/");
                    var lastPathComponent = pathComponents.pop();
                    return this.baseURL + path;//lastPathComponent;
                }
            }
        },

        _resolvePathsForCategories: {
            value: function(categories) {
                categories.forEach( function(category) {
                    var descriptions = this.json[category];
                    if (descriptions) {
                        var descriptionKeys = Object.keys(descriptions);
                        descriptionKeys.forEach( function(descriptionKey) {
                            var description = descriptions[descriptionKey];
                            description.path = this.resolvePathIfNeeded(description.path);
                        }, this);
                    }
                }, this);
            }
        },

        _json: {
            value: null,
            writable: true
        },

        json: {
            enumerable: true,
            get: function() {
                return this._json;
            },
            set: function(value) {
                if (this._json !== value) {
                    this._json = value;
                    this._resolvePathsForCategories(["buffers", "shaders"]);
                }
            }
        },

        _path: {
            value: null,
            writable: true
        },

        getEntryDescription: {
            value: function (entryID, entryType) {
                var entryDescription = null;
                var entries = null;

                var category = categoryForType[entryType];
                entries = this.rootDescription[category];
                if (!entries) {
                    console.log("ERROR:CANNOT find expected category named:"+category)
                    return null;
                }

                return entries ? entries[entryID] : null;
            }
        },

        _stepToNextCategory: {
            value: function() {
                this._state.categoryIndex = this.getNextCategoryIndex(this._state.categoryIndex + 1);
                if (this._state.categoryIndex !== -1) {
                    var category = categoriesDepsOrder[this._state.categoryIndex];
                    this._state.categoryState.index = 0;
                    return true;
                } else {
                    return false;
                }
            }
        },

        _stepToNextDescription: {
            enumerable: false,
            value: function() {
                var category = categoriesDepsOrder[this._state.categoryIndex];
                var categoryState = this._state.categoryState;
                var keys = categoryState.keys;
                if (!keys) {
                    console.log("INCONSISTENCY ERROR");
                    return false;
                } else {
                    categoryState.index++;
                    categoryState.keys = null;
                    if (categoryState.index >= keys.length) {
                        return this._stepToNextCategory();
                    }
                    return false;;
                }
            }
        },

        hasCategory: {
            value: function(category) {
                return this.rootDescription[category] ? true : false;
            }
        },

        _handleState: {
            value: function() {

                var methodForType = {
                    "buffer" : this.handleBuffer,
                    "shader" : this.handleShader,
                    "technique" : this.handleTechnique,
                    "material" : this.handleMaterial,
                    "mesh" : this.handleMesh,
                    "camera" : this.handleCamera,
                    "light" : this.handleLight,
                    "node" : this.handleNode,
                    "scene" : this.handleScene
                };

                var success = true;
                var self = this;
                while (this._state.categoryIndex !== -1) {
                    var category = categoriesDepsOrder[this._state.categoryIndex];
                    var categoryState = this._state.categoryState;
                    var keys = categoryState.keys;
                    if (!keys) {
                        categoryState.keys = keys = Object.keys(this.rootDescription[category]);
                    }
                    var type = typeForCategory[category];
                    var entryID = keys[categoryState.index];
                    var description = this.getEntryDescription(entryID, type);
                    if (!description) {
                        if (this.handleError) {
                            this.handleError("INCONSISTENCY ERROR: no description found for entry "+entryID);
                            success = false;
                            break;
                        }
                    } else {
                        if (methodForType[type]) {
                            if (methodForType[type].call(this, entryID, description, this._state.userInfo) === false) {
                                success = false;
                                break;
                            }
                        }

                        this._stepToNextDescription();
                    }
                }

                if (this.handleLoadCompleted) {
                    this.handleLoadCompleted(success);
                }

            }
        },

        _loadJSONIfNeeded: {
            enumerable: true,
            value: function(callback) {
                var self = this;

                //FIXME: handle error
                if (!this._json)  {
                    var baseURL;
                    var parser = document.createElement("a");

                    parser.href = window.location.href;
                    var port = "";
                    if (parser.port)
                        port += ":"+parser.port;

                    baseURL = parser.protocol+"//"+parser.hostname+ port;
                    if (parser.pathname.charAt(parser.pathname.length - 1) !== '/') {
                        var filebase = parser.pathname.split("/");
                        filebase.pop();
                        baseURL += filebase.join("/") + "/";
                    } else {
                        baseURL += parser.pathname;
                    }

                    if (!this._isAbsolutePath(this._path)) {
                        //we don't want the last component of the path
                        var pathBase = this._path.split("/");
                        if (pathBase.length > 1) {
                            pathBase.pop();
                            baseURL += pathBase.join("/") + "/";
                        }
                    }
                    this.baseURL = baseURL;

                    var jsonfile = new XMLHttpRequest();
                    jsonfile.open("GET", this._path, true);
                    jsonfile.onreadystatechange = function() {
                        if (jsonfile.readyState == 4) {
                            if (jsonfile.status == 200) {
                                self.json = JSON.parse(jsonfile.responseText);
                                if (callback) {
                                    callback(self.json);
                                }
                            }
                        }
                    };
                    jsonfile.send(null);
               } else {
                    if (callback) {
                        callback(this.json);
                    }
                }
            }
        },

        /* load JSON and assign it as description to the reader */
        _buildLoader: {
            value: function(callback) {
                var self = this;
                function JSONReady(json) {
                    self.rootDescription = json;
                    if (callback)
                        callback(this);
                }

                this._loadJSONIfNeeded(JSONReady);
            }
        },

        _state: { value: null, writable: true },

        _getEntryType: {
            value: function(entryID) {
                var rootKeys = categoriesDepsOrder;
                for (var i = 0 ;  i < rootKeys.length ; i++) {
                    var rootValues = this.rootDescription[rootKeys[i]];
                    if (rootValues) {
                        return rootKeys[i];
                    }
                }
                return null;
            }
        },

        getNextCategoryIndex: {
            value: function(currentIndex) {
                for (var i = currentIndex ; i < categoriesDepsOrder.length ; i++) {
                    if (this.hasCategory(categoriesDepsOrder[i])) {
                        return i;
                    }
                }

                return -1;
            }
        },

        load: {
            enumerable: true,
            value: function(userInfo, options) {
                var self = this;
                this._buildLoader(function loaderReady(reader) {
                    var startCategory = self.getNextCategoryIndex.call(self,0);
                    if (startCategory !== -1) {
                        self._state = { "userInfo" : userInfo,
                                        "options" : options,
                                        "categoryIndex" : startCategory,
                                        "categoryState" : { "index" : "0" } };
                        self._handleState();
                    }
                });
            }
        },

        initWithPath: {
            value: function(path) {
                this._path = path;
                this._json = null;
                return this;
            }
        },

        initWithJSON: {
            value: function(json, baseURL) {
                this.json = json;
                this.baseURL = baseURL;
                if (!baseURL) {
                    console.log("WARNING: no base URL passed to Reader:initWithJSON");
                }
                return this;
            }
        }

    });

    if(root) {
        root.WebGLTFLoader = WebGLTFLoader;
    }

    return WebGLTFLoader;

}));
