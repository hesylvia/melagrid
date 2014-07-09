var redrugsApp = angular.module('redrugsApp', []);

redrugsApp.controller('ReDrugSCtrl', function ReDrugSCtrl($scope, $http) {
    $scope.elements = {
        nodes:[],
        edges:[]
    };
    $scope.nodeMap = {};
    $scope.edges = [];
    $scope.edgeMap = {};
    $scope.resources = {};
    $scope.searchTerms = "";
    $scope.searchTermURIs = {};
    $scope.getNode = function(res) {
        var node = $scope.nodeMap[res.uri];
        if (!node) {
            node = $scope.nodeMap[res.uri] = {
                group: "nodes",
                data: {
                    id: res.uri,
                    types: {},
                    resource: res
                }
            };
            node.data.label = res[$scope.ns.rdfs('label')];
            if (res[$scope.ns.rdf('type')]) res[$scope.ns.rdf('type')].forEach(function(d) {
                node.data.types[d.uri] = true;
            })
            node.data.shape = $scope.getShape(node.data.types);
            node.data.size = $scope.getSize(node.data.types);
            node.data.color = $scope.getColor(node.data.types);
        }
        return node;
    }
    $scope.layout = {
        name: 'arbor',
        padding: [100,100,100,100]
    }

    $scope.container = $('#results');
    $scope.container.cytoscape({
        style: cytoscape.stylesheet()
            .selector('node')
            .css({
                'min-zoomed-font-size': 80,
                'content': 'data(label)',
                'text-valign': 'center',
                'color':'white',
                'background-color': 'data(color)',
                'shape': 'data(shape)',
                'text-outline-width': 2,
                'text-outline-color': 'data(color)',
                'height': 'data(size)',
                'width': 'data(size)'
            })
            .selector('edge')
            .css({
                'opacity':'data(probability)',
                'width':"mapData(likelihood,0,2.5,5,50)",
                'target-arrow-shape': 'data(shape)',
                'target-arrow-color': 'data(color)',
                'line-color': 'data(color)',

            })
            .selector(':selected')
            .css({
                'background-color': '#F7D631',
                'line-color': '#F4DD09',
                'target-arrow-color': '#F4DD09',
                'source-arrow-color': '#F4DD09',
                'opacity':1,
            })
            .selector('.faded')
            .css({
                'opacity': 0.25,
                'text-opacity': 0
            })
            .selector('.showLabel')
            .css({
                'min-zoomed-font-size': 8
            }),

        elements: [] ,

        hideLabelsOnViewport: true ,

        ready: function(){
            $scope.cy = cy = this;
            // giddy up...
            // console.log(cy.elements());
            cy.elements().unselectify();
            cy.boxSelectionEnabled(false);

            cy.on('drag', 'node', function(e) {
                $("#button-box").addClass('hidden');
            });
            cy.on('free', 'node', function(e) {
                var selected = $scope.cy.$('node:selected');
                selected.nodes().each(function(i,d) {
                    var pos = d.renderedPosition();
                    $("#button-box").css("left", pos.x-170);
                    $("#button-box").css("top", pos.y-70);
                    $("#button-box").removeClass('hidden');
                });
            });

            cy.on('select', 'node', function(e){
                var node = e.cyTarget; 
                var neighborhood = node.neighborhood().add(node);
                var pos = node.renderedPosition();
                console.log(pos);
                
                cy.elements().addClass('faded');
                neighborhood.removeClass('faded');
                node.addClass('showLabel');
                neighborhood.addClass('showLabel');
                
                $("#button-box").css("left", pos.x-170);
                $("#button-box").css("top", pos.y-70);
                $("#button-box").removeClass('hidden');

            });
            
            cy.on('vclick', function(e){
                if( e.cyTarget === cy ){
                    cy.elements().removeClass('faded');
                    cy.elements().removeClass('showLabel');
                    $("#button-box").addClass('hidden');
                }
            });

            cy.on('tapdragover', 'node', function(e) {
                var node = e.cyTarget;
                node.addClass('showLabel');
            });
            cy.on('tagdragout', 'node', function(e) {
                var node = e.cyTarget;
                node.removeClass('showLabel');
            });
        }
    });

    $scope.graph = $.Graph();
    $scope.ns = {
        rdf: $.Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#"),
        rdfs: $.Namespace("http://www.w3.org/2000/01/rdf-schema#"),
        prov: $.Namespace("http://www.w3.org/ns/prov#"),
        pml: $.Namespace("http://provenanceweb.org/ns/pml#"),
        sio: $.Namespace("http://semanticscience.org/resource/"),
        dcterms: $.Namespace("http://purl.org/dc/terms/"),
        local: $.Namespace("urn:redrugs:"),
    };
    $scope.services = {
        search: $.SadiService("/api/search"),
        process: $.SadiService("/api/process"),
        upstream: $.SadiService("/api/upstream"),
        downstream: $.SadiService("/api/downstream"),
    };
    $(".searchBox").typeahead({
        minLength: 3,
        items: 10,
        updater: function(selection) {
            // console.log(selection);
            $scope.searchTerms = selection;
            return selection;
        },
        source: function(query, process) {
            // console.log(query);
            var g = new $.Graph();
            var res = g.getResource($scope.ns.local("query"))
            res[$scope.ns.prov('value')] = [query];
            res[$scope.ns.rdf('type')] = [g.getResource($scope.ns.pml('Query'))]
            $scope.services.search(g,function(graph) {
                var keywords = graph.resources.map(function(d) {
                    return graph.getResource(d);
                }).filter(function(d) {
                    return d[$scope.ns.pml('answers')];
                }).map(function(d) {
                    var result = d[$scope.ns.rdfs('label')][0];
                    $scope.searchTermURIs[result] = d.uri;
                    return result;
                })
                process(keywords);
            }, $scope.graph, $scope.handleError);
        } 
    });
    $scope.handleError = function(data,status, headers, config) {
        $scope.error = true;
        $scope.loading = false;
    }
    $scope.getSelected = function() {
        if (!$scope.cy) return [];
        var selected = $scope.cy.$('node:selected');
        // console.log(selected.nodes());
        var query = [];
        
        selected.nodes().each(function(i,d) {
            query.push(d.id())
        });
        // console.log(query);
        return query;
    }
    $scope.createResource = function(uri, graph) {
        var entity = graph.getResource(uri,'uri');
        entity[$scope.ns.rdf('type')] = [
            graph.getResource($scope.ns.sio('process'),'uri'),
            graph.getResource($scope.ns.sio('material-entity'),'uri')
        ];
        return entity;
    }
    $scope.getInfo = function(uri, graph) {
        var entity = graph.getResource(uri, 'uri');
        entity[$scope.ns.rdf('title')] = graph.getResource($scope.ns.dcterms('title'));
        console.log(entity[$scope.ns.rdf('title')]);
    }
    $scope.addToGraph = function(query) {
        $scope.loading = true;
        $('#starting-box').css("display", "none");
        $('#interface').removeClass("hidden");
        // console.log(query);
        var g = new $.Graph();
        $scope.createResource($scope.searchTermURIs[$.trim(query)],g);
        // console.log(g.toJSON());
        $scope.services.process(g,function(graph){
            $scope.services.upstream(g,function(graph){
                $scope.services.downstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
            },$scope.graph,$scope.handleError);
        },$scope.graph,$scope.handleError);
        // console.log("This is from addToGraph: " + JSON.stringify(g));
    }
    $scope.getDetails = function(query) {
        var g = new $.Graph();
        query.forEach(function(uri) {
            $scope.getInfo(uri, g);
            // console.log(uri);
            window.open(uri);
        });
    }
    $scope.getUpstream = function(query) {
        $scope.loading = true;
        // console.log(query);
        var g = new $.Graph();
        query.forEach(function(d) {
            $scope.createResource(d,g);
        });
        // console.log(g.toJSON());
        // console.log("Upstream " + JSON.stringify(g));
        $scope.services.upstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
    }
    $scope.getDownstream = function(query) {
        $scope.loading = true;
        // console.log(query);
        var g = new $.Graph();
        query.forEach(function(d) {
            $scope.createResource(d,g);
        });
        // console.log(g.toJSON());
        // console.log("Downstream " + JSON.stringify(g));
        $scope.services.downstream(g,$scope.appendToGraph,$scope.graph,$scope.handleError);
    }
    // $scope.addToGraphU2 = function(query) {
    //     // console.log(query);
    //     query = query.split(",").map(function(d) {
    //         return encodeURIComponent($scope.searchTermURIs[$.trim(d)])
    //     }).join(",")
    //     // console.log(query);
    //     $http({method:'GET',url:"/api/addToGraphU2?uris="+ query})
    //         .success($scope.appendToGraph)
    //         .error($scope.handleError);
    // }

    $scope.edgeTypes = {
        "http://purl.obolibrary.org/obo/CHEBI_48705": "triangle",
        "http://purl.obolibrary.org/obo/MI_0190": "none",
        "http://purl.obolibrary.org/obo/CHEBI_23357": "triangle",
        "http://purl.obolibrary.org/obo/CHEBI_25212": "triangle",
        "http://purl.obolibrary.org/obo/CHEBI_35224": "none",
        "http://purl.obolibrary.org/obo/CHEBI_48706": "tee",
        "http://purl.org/obo/owl/GO#GO_0048018": "triangle",
        "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547":"tee",
        "http://purl.obolibrary.org/obo/MI_0915": "circle",
        "http://purl.obolibrary.org/obo/MI_0407": "none",
        "http://purl.obolibrary.org/obo/MI_0191": "circle",
        "http://purl.obolibrary.org/obo/MI_0914": "none",
        "http://purl.obolibrary.org/obo/MI_0217": "diamond",
        "http://purl.obolibrary.org/obo/MI_0403": "circle",
        "http://purl.obolibrary.org/obo/MI_0570": "square",
        "http://purl.obolibrary.org/obo/MI_0194": "square"
    }
    $scope.edgeColors = {
        "http://purl.obolibrary.org/obo/CHEBI_48705": "red",
        "http://purl.obolibrary.org/obo/MI_0190": "gray",
        "http://purl.obolibrary.org/obo/CHEBI_23357": "red",
        "http://purl.obolibrary.org/obo/CHEBI_25212": "red",
        "http://purl.obolibrary.org/obo/CHEBI_35224": "gray",
        "http://purl.obolibrary.org/obo/CHEBI_48706": "green",
        "http://purl.org/obo/owl/GO#GO_0048018": "red",
        "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547":"green",
        "http://purl.obolibrary.org/obo/MI_0915": "blue",
        "http://purl.obolibrary.org/obo/MI_0407": "gray",
        "http://purl.obolibrary.org/obo/MI_0191": "blue",
        "http://purl.obolibrary.org/obo/MI_0914": "gray",
        "http://purl.obolibrary.org/obo/MI_0217": "orange",
        "http://purl.obolibrary.org/obo/MI_0403": "blue",
        "http://purl.obolibrary.org/obo/MI_0570": "purple",
        "http://purl.obolibrary.org/obo/MI_0194": "purple"
    }

    $scope.getShape = function (types) {
        if (types['http://semanticscience.org/resource/activator']) {
            return "circle"
        } else if (types['http://semanticscience.org/resource/inhibitor']) {
            return "circle"
        } else if (types['http://semanticscience.org/resource/protein']) {
            return "hexagon"
        } else {
            return "square"
        }
    };
    $scope.getSize = function (types) {
        if (types['http://semanticscience.org/resource/activator'] || types['http://semanticscience.org/resource/inhibitor']) { return '70'; }
        else { return '50'; }
    };

    $scope.getColor = function (types) {
        if (types['http://semanticscience.org/resource/activator']) {
            return "#FF4700"
        } else if (types['http://semanticscience.org/resource/inhibitor']) {
            return "#00B293"
        } else if (types['http://semanticscience.org/resource/protein']) {
            return "green"
        } else {
            return "gray"
        }
    };
    $scope.appendToGraph = function(result) {
        // console.log(result);
        var elements = [];
        result.resources.map(function(d) {
            return result.getResource(d);
        })
            .filter(function(d) {
                return d[$scope.ns.sio('has-target')];
            })
            //.filter(function(d) {
            //    if (!d[$scope.ns.sio('probability-value')])
            //        console.log(d);
            //    return d[$scope.ns.sio('probability-value')][0] > 0.9;
            //})
            .forEach(function(d) {
                var s = d[$scope.ns.sio('has-participant')][0];
                var t = d[$scope.ns.sio('has-target')][0];
                var source = $scope.getNode(s);
                var target = $scope.getNode(t);
                elements.push(source);
                elements.push(target);
                var edgeTypes = d[$scope.ns.rdf('type')];
                var edge = {
                    group: "edges",
                    data: $().extend({}, d, {
                        id: d[$scope.ns.prov('wasDerivedFrom')][0].uri,
                        source: source.data.id,
                        target: target.data.id,
                        shape: 'triangle',
                        color: edgeTypes ? $scope.edgeColors[edgeTypes[0].uri] : 'none',
                        probability: d[$scope.ns.sio('probability-value')][0],
                        likelihood: d[$scope.ns.sio('likelihood')][0],
                        resource: d
                    })
                };
                if (edgeTypes && !$scope.edgeTypes[edgeTypes[0].uri])
                    console.log("Missing interaction type:", edgeTypes[0].uri);
                elements.push(edge);
            });
        $scope.cy.add(elements);
        $scope.cy.layout($scope.layout);
        $scope.$apply(function(){
            $scope.loading = false;
        });
        $("#button-box").addClass('hidden');
        $scope.loaded = result.resources.length;
    }

    $scope.result = $("#result");

    $("#zoom-fit").click(function() {
        $scope.cy.fit(50); 
    });
    $("#zoom-in").click(function() {
        $scope.cy.zoom({
            level: $scope.cy.zoom() + 0.5
        });
    });
    $("#zoom-out").click(function() {
        if ($scope.cy.zoom() >= 0.5) {
            $scope.cy.zoom({
                level: $scope.cy.zoom() - 0.5
            });
        }
    });
})