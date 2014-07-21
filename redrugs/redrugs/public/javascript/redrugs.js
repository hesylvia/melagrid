var redrugsApp = angular.module('redrugsApp', []);

redrugsApp.controller('ReDrugSCtrl', function ReDrugSCtrl($scope, $http) {
    $scope.elements = {
        nodes:[],
        edges:[]
    };
    $scope.nodeMap = {};
    $scope.edges = [];
    $scope.edgeMap = {};
    $scope.edgesFilter = {
        triangle: true,
        tee: true,
        circle: true,
        diamond: true,
        square: true,
        none: true,
        other: true
    };
    $scope.layout = {
        name: 'arbor',
        padding: [100,100,100,100]
    }
    $scope.resources = {};
    $scope.searchTerms = "";
    $scope.searchTermURIs = {};
    $scope.showLabel = true;

    $scope.container = $('#results');
    $scope.result = $("#result");
    $scope.createGraph = function() {
        $scope.container.cytoscape({
            style: cytoscape.stylesheet()
                .selector('node')
                .css({
                    'min-zoomed-font-size': 8,
                    'content': 'data(label)',
                    'text-valign': 'center',
                    'color':'white',
                    'background-color': 'data(color)',
                    'shape': 'data(shape)',
                    'text-outline-width': 2,
                    'text-outline-color': 'data(textlinecolor)',
                    'border-color': 'data(linecolor)',
                    'border-width': 2,
                    'height': 'data(size)',
                    'width': 'data(size)',
                    'cursor': 'pointer'
                })
                .selector('edge')
                .css({
                    'opacity':'data(probability)',
                    'width':'data(width)',
                    'line-style': 'data(lineStyle)',
                    'target-arrow-shape': 'data(shape)',
                    'target-arrow-color': 'data(color)',
                    'line-color': 'data(color)'
                })
                .selector(':selected')
                .css({
                    'background-color': '#D8D8D8',
                    'line-color': '#D8D8D8',
                    'target-arrow-color': '#D8D8D8',
                    'source-arrow-color': '#D8D8D8',
                    'opacity':1,
                })
                .selector('.highlighted')
                .css({
                    'background-color': '#000000',
                    'line-color': '#000000',
                    'target-arrow-color': '#000000',
                    'transition-property': 'background-color, line-color, target-arrow-color, height, width',
                    'transition-duration': '0.5s'
                })
                .selector('.hidden')
                .css({
                    'opacity': 0,
                })
                .selector('.faded')
                .css({
                    'opacity': 0.25,
                    'text-opacity': 0
                })
                .selector('.hideLabel')
                .css({
                    'text-opacity': 0
                }),

            elements: [] ,

            hideLabelsOnViewport: true ,

            ready: function(){
                $scope.cy = cy = this;
                cy.boxSelectionEnabled(false);

                // Hides dynamically revealed objects on page
                cy.on('drag', function(e) {
                    $("#button-box").addClass('hidden');
                    $("#edge-info").addClass('hidden');
                });
                cy.on('pan', function(e) {
                    $("#button-box").addClass('hidden');
                    $("#edge-info").addClass('hidden');
                });
                cy.on('zoom', function(e) {
                    $("#button-box").addClass('hidden');
                    $("#edge-info").addClass('hidden');
                });
                cy.on('tapdragover', 'node', function(e) {
                    var node = e.cyTarget;
                    if (!$scope.showLabel) {
                        node.removeClass('hideLabel');
                    }
                });
                cy.on('tagdragout', 'node', function(e) {
                    var node = e.cyTarget;
                    if (!$scope.showLabel) {
                        node.addClass('hideLabel');
                    }
                });
                cy.on('free', 'node', function(e) {
                    var selected = $scope.cy.$('node:selected');
                    selected.nodes().each(function(i,d) {
                        var pos = d.renderedPosition();
                        $("#button-box").css("left", pos.x-140);
                        $("#button-box").css("top", pos.y-100);
                        $("#button-box").removeClass('hidden');
                    });
                });
                // Double-clicking on whitespace removes all CSS changes
                cy.on('vclick', function(e){
                    if( e.cyTarget === cy ){
                        cy.elements().removeClass('faded');
                        if (!$scope.showLabel) {
                            cy.elements().addClass('hideLabel');
                        }
                        $("#button-box").addClass('hidden');
                        $("#edge-info").addClass('hidden');
                        cy.elements().removeClass("highlighted");
                    }
                });

                // Double-clicking a node...
                cy.on('select', 'node', function(e){
                    var node = e.cyTarget; 
                    var neighborhood = node.neighborhood().add(node);
                    var pos = node.renderedPosition();
                    console.log(pos);
                    
                    cy.elements().addClass('faded');
                    neighborhood.removeClass('faded');
                    if (!$scope.showLabel) {
                        node.removeClass('hideLabel');
                        neighborhood.removeClass('hideLabel');
                    }
                    
                    $("#button-box").css("left", pos.x-220);
                    $("#button-box").css("top", pos.y-60);
                    $("#button-box").removeClass('hidden');

                    // console.log(cy.json());
                });
                // Double-clicking an edge...
                cy.on('click', 'edge', function(e) {
                    var pos = e.cyRenderedPosition;
                    var edge = e.cyTarget;
                    console.log(edge.data().width); 
                    $("#edge-info").html("<p>Interaction: " + edge.data().types + "</p><p> Probability: " + edge.data().probability + "</p> Likelihood: " + edge.data().likelihood );
                    $("#edge-info").css("left", pos.x+20);
                    $("#edge-info").css("top", pos.y-10);
                    $("#edge-info").removeClass('hidden');
                    // console.log(e.cyRenderedPosition);
                    // console.log(edge.data().types);
                });
            }
        });
    }
    $scope.createGraph();

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

    // Bootstrap 2 Typeahead function that calls api.py search
    $(".searchBox").typeahead({
        minLength: 3,
        items: 20,
        updater: function(selection) {
            // console.log(selection);
            $scope.searchTerms = selection;
            return selection;
        },
        source: function(query, process) {
            // console.log(query);
            var g = new $.Graph();
            var res = g.getResource($scope.ns.local("query"));
            res[$scope.ns.prov('value')] = [query];
            res[$scope.ns.rdf('type')] = [g.getResource($scope.ns.pml('Query'))];
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
                if (keywords.length === 0) {
                    keywords = ["No Matches Found"];
                }
                process(keywords);
            }, $scope.graph, $scope.handleError);
        } 
    });

    $scope.handleError = function(data,status, headers, config) {
        $scope.error = true;
        $scope.loading = false;
    }
    $scope.getSelected = function(attr) {
        if (!$scope.cy) return [];
        var selected = $scope.cy.$('node:selected');
        // console.log(selected.nodes());
        var query = [];
        
        selected.nodes().each(function(i,d) {
            query.push(d.data(attr));
        });
        // console.log(query);
        return query;
    }
    // Gets the details of the selected node
    $scope.getDetails = function(query) {
        var g = new $.Graph();
        query.forEach(function(uri) {
            window.open(uri);
        });
    }
    // Shows BFS animation starting from selected node
    $scope.showBFS = function(query) {
        var g = new $.Graph();
        query.forEach(function(id) {
            cy.elements().removeClass("highlighted");
            var root = "#" + id;
            var bfs = cy.elements().bfs(root, function(i, depth){
                console.log( 'visit ' + this.id() );
            }, true);
        
            var i = 0;
            var highlightNextEle = function(){
              bfs.path[i].addClass('highlighted');
              bfs.path[i].removeClass('faded');
              
              if( i < bfs.path.length - 1){
                i++;
                setTimeout(highlightNextEle, 100);
              }
            };
            highlightNextEle();
        });
    }
    // Used to filter edge interaction types based on color of edge
    $scope.filter = function(query) {
        $scope.cy.edges().each(function(i, ele){
            ele.addClass("hidden");
        });
        console.log(query);
        if (query.triangle === true) {
            $scope.cy.elements('edge[color="#9AFE2E"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.tee === true) {
            $scope.cy.elements('edge[color="#C71585"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.circle === true) {
            $scope.cy.elements('edge[color="#00FFFF"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.diamond === true) {
            $scope.cy.elements('edge[color="#FF2600"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.square === true) {
            $scope.cy.elements('edge[color="#000000"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.none === true) {
            $scope.cy.elements('edge[color="#FF0040"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        } if (query.other === true) {
            $scope.cy.elements('edge[color="#BABABA"]').each(function(i, ele){ 
                ele.removeClass("hidden"); });
        }
    }

    // Maps edge interaction types to values for Cytoscape visualization
    $scope.edgeTypes = {
        "http://purl.obolibrary.org/obo/CHEBI_48705": "Agonist",                   
        "http://purl.obolibrary.org/obo/MI_0190": "Molecule Connection",  
        "http://purl.obolibrary.org/obo/CHEBI_23357": "Cofactor",                  
        "http://purl.obolibrary.org/obo/CHEBI_25212": "Metabolite",                
        "http://purl.obolibrary.org/obo/CHEBI_35224": "Effector",                   
        "http://purl.obolibrary.org/obo/CHEBI_48706": "Antagonist",                
        "http://purl.org/obo/owl/GO#GO_0048018": "Receptor Agonist Activity",                     
        "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547":"Receptor Inhibitor Activity",    
        "http://purl.obolibrary.org/obo/MI_0915": "Physical Association",          
        "http://purl.obolibrary.org/obo/MI_0407": "Direct Interaction",          
        "http://purl.obolibrary.org/obo/MI_0191": "Aggregation",                   
        "http://purl.obolibrary.org/obo/MI_0914": "Association",                    
        "http://purl.obolibrary.org/obo/MI_0217": "Phosphorylation Reaction",     
        "http://purl.obolibrary.org/obo/MI_0403": "Colocalization",               
        "http://purl.obolibrary.org/obo/MI_0570": "Protein Cleavage",              
        "http://purl.obolibrary.org/obo/MI_0194": "Cleavage Reaction"             
    }
    $scope.edgeShapes = {
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
        "http://purl.obolibrary.org/obo/MI_0194": "square",
    }
    $scope.edgeColors = {
        "http://purl.obolibrary.org/obo/CHEBI_48705": "#9AFE2E",//YELLOW
        "http://purl.obolibrary.org/obo/MI_0190": "#FF0040",//purple
        "http://purl.obolibrary.org/obo/CHEBI_23357": "#9AFE2E",//YELLOW
        "http://purl.obolibrary.org/obo/CHEBI_25212": "#9AFE2E",//YELLOW
        "http://purl.obolibrary.org/obo/CHEBI_35224": "#FF0040",//purple
        "http://purl.obolibrary.org/obo/CHEBI_48706": "#C71585",//WASSALMON#FA8072 NOW PINKRED
        "http://purl.org/obo/owl/GO#GO_0048018": "#9AFE2E",//YELLOW
        "http://www.berkeleybop.org/ontologies/owl/GO#GO_0030547":"#C71585",//PINKRED
        "http://purl.obolibrary.org/obo/MI_0915": "#00FFFF",//aqua
        "http://purl.obolibrary.org/obo/MI_0407": "#FF0040",//purple
        "http://purl.obolibrary.org/obo/MI_0191": "#00FFFF",//aqua
        "http://purl.obolibrary.org/obo/MI_0914": "#FF0040",//purple
        "http://purl.obolibrary.org/obo/MI_0217": "#9800FF",
        "http://purl.obolibrary.org/obo/MI_0403": "#00FFFF",//aqua
        "http://purl.obolibrary.org/obo/MI_0570": "#000000",
        "http://purl.obolibrary.org/obo/MI_0194": "#000000"
    }

    // Maps node types to values for Cytoscape visualization
    $scope.getShape = function (types) {
        if (types['http://semanticscience.org/resource/activator']) {
            return "triangle"
        } else if (types['http://semanticscience.org/resource/inhibitor']) {
            return "star"
        } else if (types['http://semanticscience.org/resource/protein']) {
            return "square"
        } else {
            return "circle"
        }
    };
    $scope.getSize = function (types) {
        if (types['http://semanticscience.org/resource/activator'] || types['http://semanticscience.org/resource/inhibitor']) { return '70'; }
        else { return '50'; }
    };
    $scope.getColor = function (types) {
        if (types['http://semanticscience.org/resource/activator']) {
            return "#FFD700"//BLUE
        } else if (types['http://semanticscience.org/resource/inhibitor']) {
            return "#C71585"
        } else if (types['http://semanticscience.org/resource/protein']) {
            return "#FFA500"
        } else {
            return "#FF7F50" //#FFFF00
        }
    };
    $scope.getTextlineColor = function (types) {
        if (types['http://semanticscience.org/resource/activator']) {
            return "#333333"//BLUE
        } else if (types['http://semanticscience.org/resource/inhibitor']) {
            return "#444444"
        } else if (types['http://semanticscience.org/resource/protein']) {
            return "#444444"
        } else {
            return "#333333" //#FFFF00
        }
    };

    // Functions to create and add values to graph
    $scope.createResource = function(uri, graph) {
        var entity = graph.getResource(uri,'uri');
        entity[$scope.ns.rdf('type')] = [
            graph.getResource($scope.ns.sio('process'),'uri'),
            graph.getResource($scope.ns.sio('material-entity'),'uri')
        ];
        return entity;
    }
    $scope.addToGraph = function(query) {
        $scope.loading = true;
        $('#starting-box').css("display", "none");
        $('#interface').removeClass("hidden");
        $('#first-bfs').removeClass("hidden");
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
    $scope.getUpstream = function(query) {
        $scope.loading = true;
        // console.log(query);
        var g = new $.Graph();
        query.forEach(function(d) {
            $scope.createResource(d,g);
        });
        // console.log(g.toJSON());
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

    $scope.getNode = function(res) {
        var node = $scope.nodeMap[res.uri];
        if (!node) {
            node = $scope.nodeMap[res.uri] = {
                group: "nodes",
                data: {
                    uri: res.uri,
                    // id: res.uri,
                    types: {},
                    resource: res
                }
            };
            // Remove all non-alphanumerical and replace space and underscore with hypen
            node.data.id = res[$scope.ns.rdfs('label')][0].replace(/[^a-z0-9\s]/gi, '').replace(/[_\s]/g, '-');
            node.data.label = res[$scope.ns.rdfs('label')];
            if (res[$scope.ns.rdf('type')]) res[$scope.ns.rdf('type')].forEach(function(d) {
                node.data.types[d.uri] = true;
            })
            node.data.shape = $scope.getShape(node.data.types);
            node.data.size = $scope.getSize(node.data.types);
            node.data.color = $scope.getColor(node.data.types);
            node.data.linecolor = "#FFFF00";
            node.data.textlinecolor = $scope.getTextlineColor(node.data.types);
        }
        return node;
    }
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
                var lineStyle;
                if (d[$scope.ns.sio('probability-value')][0] > 0.95) {
                    lineStyle = 'solid';
                } else if (d[$scope.ns.sio('probability-value')][0] > 0.85) {
                    lineStyle = 'dashed';
                } else {
                    lineStyle = 'dotted';
                }
                var edge = {
                    group: "edges",
                    data: $().extend({}, d, {
                        id: d[$scope.ns.prov('wasDerivedFrom')][0].uri,
                        source: source.data.id,
                        target: target.data.id, 
                        shape: edgeTypes ? $scope.edgeShapes[edgeTypes[0].uri] : 'none',
                        types: (edgeTypes && !$scope.edgeTypes[edgeTypes[0].uri]) ? 'Interaction with Disease' : $scope.edgeTypes[edgeTypes[0].uri],
                        color: edgeTypes ? $scope.edgeColors[edgeTypes[0].uri] : 'none',
                        probability: d[$scope.ns.sio('probability-value')][0],
                        likelihood: d[$scope.ns.sio('likelihood')][0],  // z-score-value
                        lineStyle: lineStyle,
                        width: (d[$scope.ns.sio('likelihood')][0] * 4) + 1,
                        resource: d
                    })
                };
                console.log(edge.data.types);
                elements.push(edge);
            });
        $scope.cy.add(elements);
        if (!$scope.showLabel) {
            $scope.cy.elements().addClass("hideLabel");
        }
        $scope.cy.layout($scope.layout);
        $scope.$apply(function(){
            $scope.loading = false;
        });
        $("#button-box").addClass('hidden');
        $scope.loaded = result.resources.length;
    };
    
    // Functionality for starting-page help
    $('.help').mouseover(function(){ $('.help-info').show(); });
    $('.help').mouseleave(function(){ $('.help-info').hide(); });

    // Toggle visibility function for top left button
    $("#min-search").click(function() {
        $("#max-search").toggle();
        if($('#min-search').html() === '<i class="fa fa-chevron-circle-left"></i>') {
            $('#min-search').html('<i class="fa fa-chevron-circle-right"></i>');
             $('#search-box').css("width", "35px");
             $('#search-box').css("height", "50px");        
        }
        else {
            $('#min-search').html('<i class="fa fa-chevron-circle-left"></i>');
            $('#search-box').css("width", "355px");
            $('#search-box').css("height", "");
        }
    });

    // Starts new Cytoscape visualization instead of adding to existing
    $(".search-btn").click(function() {
        $scope.createGraph();
        $scope.addToGraph($scope.searchTerms);
    });

    // Options functionality
    // Zoom functionality
    $("#zoom-fit").click(function() { $scope.cy.fit(50); });
    $("#zoom-in").click(function() {
        var midx = $(window).width() / 2;
        var midy = $(window).height() / 2;
        $scope.cy.zoom({
            level: $scope.cy.zoom() + 0.25,
            renderedPosition: { x: midx, y: midy }
        });
    });
    $("#zoom-out").click(function() {
        if ($scope.cy.zoom() >= 0.25) {
            var midx = $(window).width() / 2;
            var midy = $(window).height() / 2;
            $scope.cy.zoom({
                level: $scope.cy.zoom() - 0.25,
                renderedPosition: { x: midx, y: midy }
            });
        }
    });

    $("#show-lbl").click(function() {
        $scope.showLabel = true;
        $scope.cy.elements().removeClass('hideLabel');
    });
    $("#hide-lbl").click(function() {
        $scope.showLabel = false;
        $scope.cy.elements().addClass('hideLabel');
    });

    $("#bg-dark").click(function() {
        $('body').css("background", 'url("../img/congruent_outline.png")');
    });
    $("#bg-light").click(function() {
        $('body').css("background", 'url("../img/dimension.png")');
    });

    // First BFS function
    $('#first-bfs').click(function() {
        var found = false;
        $scope.cy.nodes().each(function(i, ele){
            if (!i) {
                cy.elements().removeClass("highlighted");
                var root = "#" + ele.id();
                var bfs = cy.elements().bfs(root, function(){}, true);
                if (bfs.path.length > 1) {
                    var i = 0;
                    var highlightNextEle = function(){
                      bfs.path[i].addClass('highlighted');
                      bfs.path[i].removeClass('faded');
                      
                      if( i < bfs.path.length - 1){
                        i++;
                        setTimeout(highlightNextEle, 100);
                      }
                    };
                    highlightNextEle();
                    found = true;
                }
            }
        });
    });
})