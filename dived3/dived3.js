(function(){

var dived3 = window.dived3 || {};

dived3.version = '0.0.1a';
dived3.dev = true; //set false when in production

window.dived3 = dived3;

dived3.graphs = [];
dived3.utils = {};
dived3.controls = {};
dived3.context = {};
dived3.tooltip = {};
dived3.emphasis = {};
dived3.mining = {};

dived3.newGraph= function(typesProvided){
    var id = dived3.graphs.length;

    dived3.graphs.push(dived3.graph(id, typesProvided));

    return dived3.graphs[id];
}
dived3.graph = function(id, typesProvided) {
    if(dived3.dev) console.log("Graph: ", id, typesProvided.length);

    /* Private Variables */
    var graphID = id;

    var margin = { top: 20, right: 20, bottom: 80, left: 60 },
        totalWidth = 1200,
        totalHeight = 700;

    // Scales and Axes
    var xScale = d3.time.scale(),
        yScale = [],
        xAxis = d3.svg.axis().scale(xScale).orient("bottom").ticks(5),
        yAxis = [];

    // Context graph
    var context = false,
        xScaleC = d3.time.scale(),
        brush = d3.svg.brush();

    // Tooltip
    var showTooltips = false,
        tooltipDate;

    // Legend and Axes labels
    var showLegend = false,
        legendLabels = [],
        axesLabelsProvided = [],
        axesLabels = [];

    // List of groups, ie variables which need to be grouped on each y-axis
    var axisGroup = [];

    // Configuration info about variables: type, index, group, selected
    var variables = [];

    var numVars = 0,
        numBars = 0,
        numStacks = 0;

    var noneSelected = true;

    var categoryCount = 0,
        legendCategoryLabels = [],
        categorySelected = [],
        cNoneSelected = true;

    // Boolean array. Values dictate whether the bars on corresponding y-axis groups will be stacked or grouped
    var barsStacked = [];

    //TODO: sort data array by time - done earlier this way
    //data sort time order - good but seems messy
    //data.sort(function(a,b){return a.time - b.time});

    function chart(selection) {
        selection.each(function (data) {
            //Trim variables array if number of types provided is more than the actual number of variables in the dataset 
        	console.log("Graph: ", data[0].phenomena.length); 
            if (typesProvided.length > data[0].phenomena.length) {
                typesProvided.splice(data[0].phenomena.length, typesProvided.length - data[0].phenomena.length);
            }
            

            /* Create variables array
             * type: type of graph, 1 = line, 2 = scatterplot, 3 = bar
             * index: index of variable in the data.values array, === data.values.id
             * group: y-axis group this variable belongs to
             * selected: toggle for highlighting variables
             */
            typesProvided.forEach(function (t, i) {
                // Use name of variable from data array if not provided by user
                var name =  legendLabels.length > i ? legendLabels[i] :  data[0].phenomena[i].name;
                if (t === "line" || t === "l" || t === "1" || t === 1) {
                    variables.push({type: 1, index: i, name: name, groupid: axisGroup[i] || 0, selected: false});
                } else if (t === "scatter" || t === "s" || t === "2" || t === 2) {
                    variables.push({type: 2, index: i, name: name, groupid: axisGroup[i] || 0, selected: false});
                } else if (t === "bar" || t === "b" || t === "3" || t === 3) {
                    numBars++;
                    variables.push({type: 3, index: i, name: name, groupid: axisGroup[i] || 0, selected: false});
                }
            });

            if (dived3.dev) console.log("variables", variables);

            numVars = variables.length; //number of variables being plotted

            // Prepare y scales
            /* yScale object format:
             * id: group id given by user
             * scale: the actual scale object
             * vars: the variables form the dataset that will use this scale
             */
            variables.forEach(function (v,i) {
                // Find out if a yScale object already exists for the current variable's groupid
                var groupExists = false;
                var groupIndex = -1;
                yScale.forEach(function (y, j) {
                    if (v.groupid !== 0 && y.id === v.groupid) {
                        groupExists = true;
                        groupIndex = j;
                    }
                });

                if (!groupExists) {
                    yScale.push({id: v.groupid, scale: d3.scale.linear().nice(), vars: [v.index]});
                    yAxis.push(d3.svg.axis());
                } else {
                    yScale[groupIndex].vars.push(v.index);
                }

                //save the index of the scale for each value
                v.groupid = yScale.length - 1;
            });


            numStacks = 0;
            //Check if bars need to be stacked.
            yScale.forEach(function (y, i) {
                if (barsStacked.length >= i && y.id !== 0 && barsStacked[i] === true) {
                    y.stacked = barsStacked[0];
                    barsStacked.splice(0, 1);
                    numStacks++;
                } else
                    y.stacked = false;
            });

            if(dived3.dev) console.log("yScale", yScale);

            // Dimensions of graph area.
            var w = totalWidth - margin.left - margin.right - ((yScale.length - 1) * 60),
                h = totalHeight - margin.top - margin.bottom;
            console.log("w h", w, h);

            /* Because the x-axis label is at the start of the bars rather than the middle,
             * the last value for bar graphs is cut off. So plot an extra day for the x-axis
             * to preserve last value. */
            if (numBars > 0) {
                var maxDate = d3.max(data, function (d) {return d.time;});
                maxDate.setDate(maxDate.getDate() + 1);
            }

            xScale
                .domain(d3.extent(data, function (d) { return d.time; }))
                .range([0, w]);

            if (numBars > 0) {
                maxDate.setDate(maxDate.getDate() - 1);
            }

            // Select the svg element, if it exists.
            var svg = d3.select(this).selectAll("svg").data([data]);

            // Otherwise, create the skeletal chart.
            var gEnter = svg.enter().append("svg").append("g");

            // Update the outer dimensions.
            svg.attr("width", totalWidth)
                .attr("height", totalHeight);

            // Update the inner dimensions.
            var graph = gEnter.append("g").classed("dived3 dived-graph-" + graphID , true)
                .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

            gEnter.append("defs").append("clipPath")
                .attr("id", "dived-clip-" + graphID)
                .append("rect").attr("width", w).attr("height", h);

            // Add x-axis
            graph.append("g")
                .classed("dived3 dived-axis dived-x", true)
                .attr("transform", "translate(0," + h + ")")
                .call(xAxis);

            // Add y-axes
            yScale.forEach(function (y, i) {
                var max;
                if (!y.stacked) {
                    max = d3.max(data, function (d) { return d.phenomena[y.vars[0]].value; });
                    if (y.id === 0) {
                        // for ungrouped axes, max is just max of the corresponding values array
                        max += max / 20;
                        y.scale.domain([0, max])
                            .range([h, 0]);
                    } else {
                        // for grouped, max is max of ALL corresponding values arrays
                        y.vars.forEach(function (v, i) {
                            if (i > 0) {
                                var m = d3.max(data, function (d) { return d.phenomena[v].value; });
                                max = m > max ? m : max;
                            }
                        });
                        max += max / 20; //make sure the top of the graph isn't cut off
                        y.scale.domain([0, max])
                            .range([h, 0]);
                    }
                } else {
                    //max of stacked bars is highest y1 value
                    max = 0;
                    y.vars.forEach(function (v, i) {
                        if (variables[v].type === 3) {
                            var m = d3.max(data, function (d) { return d.phenomena[v].y1; });
                            max = m > max ? m : max;
                        }
                    });
                    max += max / 20;
                    y.scale.domain([0, max])
                        .range([h, 0]);
                }

                // first y-axis is to the left of the graph, all others to the right
                if (i === 0) {
                    yAxis[i].scale(yScale[i].scale).orient("left");
                } else {
                    yAxis[i].scale(yScale[i].scale).orient("right");
                }

                // add axis
                graph.append("g")
                    .classed("dived3 dived-axis dived-y" + i, true)
                    .attr("transform", function () {
                        if (i > 0)  return "translate(" + ((i - 1) * 60 + w) + ",0)";
                        else return "translate(0,0)";
                    })
                    .call(yAxis[i]);
            });

            //Add x axis label
            graph.append("text")
                .classed("dived3 dived-label", true)
                .attr("text-anchor", "middle")
                .attr("x", w / 2)
                .attr("y", h + 40)
                .text("Date");

            /* Setup y-axis labels. Get label from provided axesLabels array. If there's
             * nothing provided, get legend name of first variable in the axis group.
             * Also stores corresponding colour
             */
            yScale.forEach(function (y, i) {
                if (axesLabelsProvided.length > i)
                    axesLabels.push([axesLabelsProvided[i], dived3.utils.colour(y.vars[0])]);
                else
                    axesLabels.push([variables[y.vars[0]].name, dived3.utils.colour(y.vars[0])]);
            });

            if (dived3.dev) {console.log("axesLabels", axesLabels);}


            //Find category labels, TODO: find a better method
            if (categoryCount > 0) {
                var di = 0;
                var numLabelsFound = 0;

                while (legendCategoryLabels.length < categoryCount) {
                    legendCategoryLabels.push(" ");
                    categorySelected.push(false);
                }

                while (numLabelsFound < categoryCount && di < data.length) {
                    if (legendCategoryLabels[data[di].values[0].category.value] == " ") {
                        legendCategoryLabels[data[di].values[0].category.value] = data[di].values[0].category.name;
                        numLabelsFound++;
                    }
                    di++;
                }
                //}
            }

            //Add axes labels
            axesLabels.forEach(function (l, i) {
                graph.append("text")
                    .classed("dived3 dived-label", true)
                    .attr("transform", function () { return i === 0 ?  "rotate(-90)" : "rotate(90)";})
                    .attr("y", function () { return i === 0 ? -margin.left : -w - i * 55;})
                    .attr("x", function () { return i === 0 ? -(h / 2) :  h / 2;})
                    .attr("dy", "1em")
                    .text(function() { return l[0];})
                    .attr("fill", function () { return l[1];})
                    .on("mouseover", function () { dived3.emphasis.highlight(graphID, variables, yScale[i].vars);})
                    .on("mouseout", function () { dived3.emphasis.undoHighlight(graphID, variables); })
                    .on("click", function () { dived3.emphasis.select(graphID, variables, yScale[i].vars);});
            });


            var plot = graph.append("g").classed("dived3 dived-plot", true).attr("clip-path", "url(#dived-clip-" + graphID + ")");

            // Setup context graph axes
            if (context) {
                var marginC = { top: totalHeight - margin.bottom + 50, right: margin.right,
                                bottom: 20, left: margin.left },
                    hC = totalHeight - marginC.top - marginC.bottom,
                    yScaleC = [],//d3.scale.linear().domain( yScale[0].domain() ).range( [hC, 0] ),
                    xAxisC = d3.svg.axis().scale(xScaleC).orient("bottom");

                brush.x(xScaleC)
                    .on("brush", function () { onBrush(data);})
                    .on("brushend", function () {brushEnd(data);});

                xScaleC.domain(xScale.domain()).range(xScale.range());

                var graphContext = gEnter.append("g")
                    .attr("transform", "translate(" + marginC.left + "," + marginC.top + ")");

                //Add axis and brush to context
                graphContext.append("g")
                    .classed("dived3 dived-axis", true)
                    .attr("transform", "translate(0," + hC + ")")
                    .call(xAxisC);
                graphContext.append("g")
                    .classed("dived3 dived-brush", true)
                    .call(brush)
                    .selectAll("rect")
                    .attr("y", -6)
                    .attr("height", hC + 7);

                yScale.forEach(function (y) {
                    yScaleC.push({id: y.id, scale: d3.scale.linear().domain(y.scale.domain()).range([hC, 0]), stacked: y.stacked, vars: y.vars});
                });
            }

            // Add lines and scatterplots
            variables.forEach(function (v, i) {
                switch (v.type) {
                    case 1: // Line graph
                        var line = d3.svg.line()
                            .x(function (d) { return xScale(d.time); })
                            .y(function (d) { return yScale[v.groupid].scale(d.phenomena[v.index].value); });
                        //TODO-RCO should ignore missing vals when drawing lines
                        //currently all are taken as 0s which show as drop outs
                        plot.append("path")
                            .datum(data)
                            .classed("dived3 dived-line dived-id" + i, true)
                            .attr("d", line)
                            .attr("stroke", function (d) { return dived3.utils.colour(d[0].phenomena[v.index].id); })
                            .style("pointer-events", "none");

                        if (context) {
                            var lineC = d3.svg.line()
                                .x(function (d) { return xScaleC(d.time); })
                                .y(function (d) { return yScaleC[v.groupid].scale(d.phenomena[v.index].value); });

                            graphContext.append("path")
                                .datum(data)
                                .attr("d", lineC)
                                .classed("dived3 dived-lineC", true)
                                .attr("stroke", function (d) { return dived3.utils.colour(d[0].phenomena[v.index].id); })
                                .style("pointer-events", "none");
                        }

                        if (!showTooltips) { break; } //need to add scatterplot to show tooltip information on hover
                    case 2://scatterplot
                        plot.selectAll("dived-circle dived-id" + i)
                            .data(data)
                            .enter()
                            .append("circle")
                            .classed("dived3 dived-circle dived-id" + i, true)
                            .attr("cx", function (d) {
                                return xScale(d.time);
                            })
                            .attr("cy", function (d) {
                                return yScale[v.groupid].scale(d.phenomena[v.index].value);
                            })
                            .attr("r", function () { return (v.type === 2) ? 2 : 8; })
                            .attr("stroke", function (d) {
                                return dived3.utils.colour(d.phenomena[v.index].id);
                            })
                            .style("fill", function (d) { return dived3.utils.colour(d.phenomena[v.index].id);})
                            .style("fill-opacity", function () { return (v.type === 2) ? "1" : "0";})
                            .on("mousemove", function (d) {
                                if(showTooltips && (v.selected || noneSelected)) {
                                    tooltipDate = d.time;
                                    dived3.tooltip.show(d3.event.target, dived3.utils.colourH(d.phenomena[v.index].id), v.type, v.name, tooltipDate, d.phenomena[v.index].value, false);
                                }
                            })
                            .on("mouseout", function (d) {
                                if(showTooltips && (v.selected || noneSelected)) {
                                    dived3.tooltip.hide(d3.event.target, dived3.utils.colour(d.phenomena[v.index].id), v.type);
                                }
                            });

                        if (context && v.type == 2) {
                            graphContext.append("g")
                                .selectAll("circle")
                                .data(data)
                                .enter()
                                .append("circle")
                                .classed("dived3 dived-circleC", true)
                                .attr("cx", function (d) {
                                    return xScaleC(d.time);
                                })
                                .attr("cy", function (d) {
                                    return yScaleC[v.groupid].scale(d.phenomena[v.index].value);
                                })
                                .attr("r", function () { return 4;})
                                .attr("fill", function (d) {
                                    return dived3.utils.colour(d.phenomena[v.index].id);
                                })
                                .style("fill-opacity", 1);
                        }
                        break;
                }
            });

            // Add bars
            if (numBars > 0) {
                var day = plot.selectAll(".dived-day")
                    .data(data).enter()
                    .append("g")
                    .classed("dived3 dived-day",true)
                    .on("mouseover", function (d) { tooltipDate = d.time; })
                    .attr("transform", function (d) { return "translate(" + xScale(d.time) + ",0)"; });

                var barPadding = 1;
                var barWidth = numStacks > 0 ? w / data.length / (numStacks ) : w / data.length / numBars;
                if (barWidth > barPadding) barWidth -= barPadding;
                barWidth = Math.max(barWidth, 1);

                day.selectAll("rect")
                    .data(function (d) {
                        var barValues = [];
                        variables.forEach(function (t) {
                            if (t.type === 3) {
                                barValues.push(d.phenomena[t.index]);
                                barValues[barValues.length - 1].scale = t.groupid;
                            }
                        });
                        return barValues;
                    })
                    .enter()
                    .append("rect")
                    .attr("class", function (d) { return "dived3 dived-bar dived-id" + d.id;})
                    .attr("width", barWidth)
                    .attr("x", function (d, i) {
                        //TODO: if not stacked, shouldn't be offset * i, need to take into account stacked bars
                        return yScale[d.scale].stacked ? 0 : (barWidth + barPadding) * i;
                    })
                    .attr("y", function (d) {
                        return yScale[d.scale].stacked ? yScale[d.scale].scale(d.y1) : yScale[d.scale].scale(d.value);
                    })
                    .attr("height", function (d) {
                        return yScale[d.scale].stacked ? yScale[d.scale].scale(d.y0) - yScale[d.scale].scale(d.y1) : h - yScale[d.scale].scale(d.value);
                    })
                    .on("mousemove", function (d) {
                        if (showTooltips &&
                            ((categoryCount === 0 && (variables[d.id].selected || noneSelected)) ||
                                (categoryCount > 0 && (categorySelected[d.category.value] || cNoneSelected))))
                            dived3.tooltip.show(d3.event.target,
                                categoryCount > 0 ? dived3.utils.colourH[d.category.value] : dived3.utils.colourH(d.id),
                                3, d.name, tooltipDate, d.value, true
                            );
                    })
                    .on("mouseout", function (d) {
                        if (showTooltips &&
                            ((categoryCount === 0 && (variables[d.id].selected || noneSelected)) ||
                                (categoryCount > 0 && (categorySelected[d.category.value] || cNoneSelected))))
                            dived3.tooltip.hide(d3.event.target, categoryCount > 0 ? dived3.utils.colour(d.category.value) : dived3.utils.colour(d.id), 3);
                    })
                    .style("fill", function (d) { return categoryCount > 0 ? dived3.utils.colour(d.category.value) : dived3.utils.colour(d.id); });

                if (context) {
                    var dayC = graphContext.append("g").selectAll(".dived-dayC")
                        .data(data)
                        .enter()
                        .append("g")
                        .classed("dived3 dived-dayC", true)
                        .attr("transform", function (d) { return "translate(" + xScaleC(d.time) + ",0)"; });

                    dayC.selectAll("rect")
                        .data(function (d) {
                            var barValues = [];
                            variables.forEach(function (t) {
                                if (t.type === 3) {
                                    barValues.push(d.phenomena[t.index]);
                                    barValues[barValues.length - 1].scale = t.groupid;
                                }
                            });
                            return barValues;
                        })
                        .enter()
                        .append("rect")
                        .attr("class", "dived3 dived-barC")
                        .attr("width", barWidth)
                        .attr("x", function (d, i) {
                            //TODO: if not stacked, shouldn't be offset * i, need to take into account stacked bars
                            return yScaleC[d.scale].stacked ? 0 : (barWidth + barPadding) * i;
                        })
                        .attr("y", function (d) {
                            return yScaleC[d.scale].stacked ? yScaleC[d.scale].scale(d.y1) : yScaleC[d.scale].scale(d.value);
                        })
                        .attr("height", function (d) {
                            return yScaleC[d.scale].stacked ? yScaleC[d.scale].scale(d.y0) - yScaleC[d.scale].scale(d.y1) : hC - yScaleC[d.scale].scale(d.value);
                        })
                        .style("fill", function (d) { return categoryCount > 0 ? dived3.utils.colour(d.category.value) : dived3.utils.colour(d.id);})
                        .style("pointer-events", "none");
                }
            }

            d3.selectAll(".dived-line").moveToFront();
            d3.selectAll(".dived-circle").moveToFront();

            if (showLegend) {
                var legend = d3.select(svg[0].parentNode).append("svg")
                    .attr("width", totalWidth)
                    .attr("height", 300)
                    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

                if (categoryCount === 0) {
                    legend = legend.append("g")
                        .selectAll(".dived-legend")
                        .data(variables.map(function(d) { return d.name;})).enter()
                        .append("g")
                        .classed("dived3 dived-legend-" + graphID, true)
                        .attr("transform", function (d, i) { console.log(d);return "translate(" + ((w / 2 - (variables.length / 2 - 1) * 50) + i * 50 + 20) + "," + 0 + ")"; });
                } else {
                    //TODO: category
                    legend = legend.append("g")
                        .selectAll(".dived-legend")
                        .data(legendCategoryLabels).enter()
                        .append("g")
                        .classed("dived3 dived-legend", true)
                        .attr("transform", function (d, i) { return "translate(" + ((w / 2 - (legendCategoryLabels.length / 2 - 1) * 50) + i * 50 + 20) + "," + 0 + ")"; });
                }

                legend.append("rect")
                    .attr("x", 3)
                    .attr("y", 5)
                    .attr("width", 15)
                    .attr("height", 15)
                    .style("fill", function (d, i) {
                        return categoryCount === 0 ? dived3.utils.colour(i) : dived3.utils.colour(legendCategoryLabels.indexOf(d));
                    })
                    .style("stroke", function (d, i) {
                        //data[0].values[variables[i][1]].id
                        return categoryCount === 0 ? dived3.utils.colour(i) : dived3.utils.colour(legendCategoryLabels.indexOf(d));
                    })
                    .style("stroke-width", "3")
                    .attr("fill-opacity", "1")
                    .on("mouseover", function (d, i) { categoryCount === 0 ? dived3.emphasis.highlight(graphID, variables, [i]) : highlightCategory(i);})
                    .on("mouseout", function (d, i) { categoryCount === 0 ? dived3.emphasis.undoHighlight(graphID, variables) : undoHighlightCategory(i);})
                    .on("click", function (d, i) { categoryCount === 0 ? dived3.emphasis.select(graphID, variables, [i]) : selectCategory(i);});

                legend.append("text")
                    .attr("x", -30)
                    .attr("y", 15)
                    .attr("dy", "0.9em")
                    .classed("dived-legendlabel", true)
                    .style("text-anchor", "end")
                    .text(function (d) { return d; })
                    .attr("transform", function (d, i) { return "rotate(-65," + 0 + "," + 0 + ") "; })
                    .style("pointer-events", "none");
            }

        });
    }

    /* While brushing, only x positions are updated */
    function onBrush(data) {
        var w = totalWidth - margin.left - margin.right - ((yScale.length - 1) * 60);
        xScale.domain(brush.empty() ? xScaleC.domain() : brush.extent());

        var graph = d3.select(".dived-graph-" + graphID);
        graph.select(".dived-x.dived-axis").transition().duration(200).call(xAxis);
        var barNum = 0;

        variables.forEach(function (t, i) {
            switch (t.type) {
                case 1:
                    var line = d3.svg.line()
                        .x(function (d) { return xScale(d.time); })
                        .y(function (d) { return yScale[t.groupid].scale(d.phenomena[t.index].value); });
                    graph.select(".dived-line.dived-id" + i)
                        .datum(data)
                        .transition()
                        .duration(400)
                        .attr("d", line);
                    if (!showTooltips) break;
                case 2:
                    graph.selectAll(".dived-circle.dived-id" + i)
                        .data(data)
                        .attr("cx", function (d) {
                            return xScale(d.time);
                        });
                    break;
                case 3:
                    var numDays = Math.max(Math.round((xScale.domain()[1] - xScale.domain()[0]) / (24 * 60 * 60 * 1000)), 1);

                    var numDataPoints = 0;

                    var bars = graph.select(".dived-plot").selectAll(".dived-day")
                        .transition()
                        .duration(00)
                        .attr("transform", function (d) { return "translate(" + xScale(d.time) + ",0)"; })
                        .filter(function (d) {
                            if ((d.time >= xScale.domain()[0]) && (d.time <= xScale.domain()[1])) {
                                numDataPoints++;
                                return d;
                            }
                        });

                    var barWidth = numStacks > 0 ? w / Math.max(numDays, numDataPoints) / (numStacks) : w / Math.max(numDays, numDataPoints) / numBars;
                    barWidth = barWidth > 2 ? barWidth - 1 : barWidth; // add 1px padding if possible

                    bars.selectAll(".dived-bar.dived-id" + i)
                        .delay(function(d,i) { return i*10;})
                        .attr("width", barWidth)
                        .attr("x", function (d) {
                            return yScale[d.scale].stacked ? 0 : (barWidth) * barNum;

                        });
                    barNum++;
                    break;
            }
        });
    }

    /* On brush end, y scales are updated. Avoids having to recalculate max values for each axis
     * every time the brush extent changes
     */
    function brushEnd(data) {
        xScale.domain(brush.empty() ? xScaleC.domain() : brush.extent());
        var w = totalWidth - margin.left - margin.right - ((yScale.length - 1) * 60),
            h = totalHeight - margin.top - margin.bottom;

        var graph = d3.select(".dived-graph-" + graphID);

        var numDataPoints = 0;
        //Find max y values to rescale y axis
        var xRange = data.filter(function (d) {
            if ((d.time >= xScale.domain()[0]) && (d.time <= xScale.domain()[1])) {
                numDataPoints++;
                return d.phenomena;
            }
        });

        yScale.forEach(function (y, i) {
            var max;
            if (!y.stacked) {
                max = d3.max(xRange, function (d) { return d.phenomena[y.vars[0]].value; });
                if (y.id === 0) {
                    // for ungrouped axes, max is just max of the corresponding values array
                    max += max / 20;
                    y.scale.domain([0, max])
                        .range([h, 0]);
                } else {
                    // for grouped, max is max of ALL corresponding values arrays
                    y.vars.forEach(function (v, i) {
                        if (i > 0) {
                            var m = d3.max(xRange, function (d) { return d.phenomena[v].value; });
                            max = m > max ? m : max;
                        }
                    });
                    max += max / 20; //make sure the top of the graph isn't cut off
                    y.scale.domain([0, max])
                        .range([h, 0]);
                }
            } else {
                max = 0;
                y.vars.forEach(function (v, i) {
                    if (variables[v].type === 3) {
                        var m = d3.max(xRange, function (d) { return d.phenomena[v].y1; });
                        max = m > max ? m : max;
                    }
                });
                max += max / 20;
                y.scale.domain([0, max])
                    .range([h, 0]);
            }

            var selection = ".dived-y" + i;
            graph.select(selection).transition().duration(200).call(yAxis[i]);
        });

        var barNum = 0;
        variables.forEach(function (t, i) {
            switch (t.type) {
                case 1:
                    var line = d3.svg.line()
                        .x(function (d) { return xScale(d.time); })
                        .y(function (d) { return yScale[t.groupid].scale(d.phenomena[t.index].value); });

                    graph.select(".dived-line.dived-id" + i)
                        .datum(data)
                        .transition()
                        .duration(400)
                        .attr("d", line);
                    if (!showTooltips) break;
                case 2:
                    graph.selectAll(".dived-circle.dived-id" + i)
                        .data(data)
                        .transition()
                        .duration(400)
                        .attr("cx", function (d) {
                            return xScale(d.time);
                        })
                        .attr("cy", function (d) {
                            return yScale[t.groupid].scale(d.phenomena[t.index].value);
                        });
                    break;
                case 3:
                    var numDays = Math.round((xScale.domain()[1] - xScale.domain()[0]) / (24 * 60 * 60 * 1000));

                    /* numDataPoints is the number of measurements in the brush extent.
                     * numDays is the number of days between in the brush extent.
                     * for hourly readings, numDataPoints >= numDays and
                     * for daily readings, numDataPoints <= numDays (some days have no readings)
                     * the higher of the two is used to calculate the bar widths
                     */

                    var barWidth = numStacks > 0 ? w / Math.max(numDataPoints, numDays) / (numStacks) : w / Math.max(numDataPoints, numDays) / numBars;

                    barWidth = barWidth > 2 ? barWidth - 1 : barWidth; // add 1px padding if possible

                    var bars = graph.select(".dived-plot").selectAll(".dived-day")
                        .filter(function (d) {
                            if ((d.time >= xScale.domain()[0]) && (d.time <= xScale.domain()[1])) {
                                return d;
                            }
                        });
                    bars.selectAll(".dived-bar.dived-id" + i).transition().duration(400)
                        .attr("width", barWidth)
                        .attr("x", function (d) {
                            return yScale[d.scale].stacked ? 0 : (barWidth) * barNum;
                        })
                        .attr("y", function (d) {
                            return yScale[d.scale].stacked ? yScale[d.scale].scale(d.y1) : yScale[d.scale].scale(d.value);
                        })
                        .attr("height", function (d) {
                            return yScale[d.scale].stacked ? yScale[d.scale].scale(d.y0) - yScale[d.scale].scale(d.y1) : h - yScale[d.scale].scale(d.value);
                        });
                    barNum++;
                    break;


            }
        });

    }



    function highlightCategory(variable) {
        var plot = d3.select(".plot")
            .selectAll(".dived-day")
            .filter(function (d) {
                if ((d.time >= xScale.domain()[0]) && (d.time <= xScale.domain()[1])) {
                    return d;
                }
            })
            .selectAll(".dived-bar")
            .transition().duration(200)
            .attr("opacity", function (d) {
                return d.category.value === variable || categorySelected[d.category.value] ? 1 : 0.1;
            });

        d3.selectAll(".dived-legend").select("rect")
            .transition()
            .duration(200)
            .style("fill-opacity", function (d, i) {
                return variable === i || categorySelected[i] ? 1 : 0;
                //else return variable.indexOf(variables[i][1]) === -1 ? 0 : 1;
            });
    }

    function undoHighlightCategory() {
        var plot = d3.select(".dived-plot")

            .selectAll(".dived-bar")
            .transition().duration(200)
            .attr("opacity", function (d) {
                return categorySelected[d.category.value] || cNoneSelected ? 1 : 0.1;
            });

        d3.selectAll(".dived-legend").select("rect")
            .transition()
            .duration(200)
            .style("fill-opacity", function (d, i) {
                return categorySelected[i] || cNoneSelected ? 1 : 0;
            });
    }

    function selectCategory(variable) {
        cNoneSelected = true;
        categorySelected[variable] = !categorySelected[variable];

        categorySelected.forEach(function (c) { if (c === true) cNoneSelected = false;});

        d3.selectAll(".dived-legend").select("rect")
            .style("stroke", function (d, i) {
                return categorySelected[i] ? dived3.utils.colourH[i] : dived3.utils.colour(i);
            });

        highlightCategory();
    }



    chart.variables = function() {
        return variables;
    }

    chart.xScale = function() {
        return xScale;
    }

    chart.yScale = function() {
        return yScale;
    }

    chart.width = function (_) {
        if (!arguments.length) return totalWidth;
        totalWidth = _;
        return chart;
    };

    chart.height = function (_) {
        if (!arguments.length) return totalHeight;
        totalHeight = _;
        if (context) margin.bottom = totalHeight / 5;
        return chart;
    };

    chart.margin = function (_) {
        if(!arguments.length) return margin;
        return chart;
    }

    chart.x = function (_) {
        if (!arguments.length) return xValue;
        xValue = _;
        return chart;
    };

    chart.y = function (_) {
        if (!arguments.length) return yValue;
        yValue = _;
        return chart;
    };

    chart.context = function (_) {
        if (!arguments.length) return context;
        context = _;
        if (context) margin.bottom = totalHeight / 5;
        return chart;
    };

    chart.showTooltips = function (_) {
        if (!arguments.length) return showTooltips;
        showTooltips = _;
        if (showTooltips)
            dived3.tooltip.create();
        return chart;
    };

    chart.showLegend = function (_) {
        if (!arguments.length) return showLegend;
        showLegend = _;
        return chart;
    };

    chart.legendLabels = function (_) {
        if (!arguments.length) return legendLabels;
        legendLabels = _;
        return chart;
    };

    chart.axesLabels = function (_) {
        if (!arguments.length) return axesLabelsProvided;
        axesLabelsProvided = _;
        return chart;
    };

    chart.axisGroup = function (_) {
        if (!arguments.length) return axisGroup;
        axisGroup = _;
        return chart;
    };

    chart.barsStacked = function (_) {
        if (!arguments.length) return barsStacked;
        barsStacked = _;
        return chart;
    };

    chart.noneSelected = function (_) {
        if (!arguments.length) return noneSelected;
        noneSelected = _;
        return chart;
    };

    chart.categoryCount = function (_) {
        if (!arguments.length) return categoryCount;
        categoryCount = _;
        return chart;
    };
    return chart;
}

/* Data analytics controls
 * controls.js
 */

dived3.controls.setup = function () {
    function controls(selection) {
        selection.each(function (data) {
            var form = d3.select(this).append("form");

            var g = v = f = 0;

            form.append("label")
                .attr("for", "graphPick")
                .text("Graph:");

            form.append("select")
                .attr("id", "graphPick")
                .on("change", function() {
                    g = this.options[this.selectedIndex].value;
                    var opts = d3.select("#vars").selectAll("option")
                        .data(dived3.graphs[this.options[this.selectedIndex].value].variables().map(function(v) { return v.name;}));

                    opts.enter()
                        .append("option");

                    opts.attr("value",function (d) { return d;})
                        .text(function (d) { console.log(d); return d;});

                    opts.exit()
                        .remove();
                })
            .selectAll("option")
                .data(dived3.graphs)
                .enter()
                .append("option")
                .attr("value",function (d, i) { return i;})
                .text(function (d, i) { return i+1;});


            form.append("label")
                .attr("for", "vars")
                .text("Variable:");

            form.append("select")
                .attr("id", "vars")
                .style("width", "250px")
                .on("change", function() { v = this.selectedIndex;})
            .selectAll("option")
                .data(dived3.graphs[0].variables().map(function(v) { return v.name;}))
                .enter()
                .append("option")
                .attr("value", function (d) { return d;})
                .text(function(d) { return d; });

            form.append("label")
                .attr("for", "feature")
                .text("Feature:");

            form.append("select")
                .attr("id", "feature")
                .style("width", "250px")
                .on("change", function() {
                    f = this.selectedIndex;
                    if(this.selectedIndex > 3) {
                        d3.select("#period").attr("type", "hidden");
                        d3.select("#lblperiod").style("display", "none");
                        d3.select("#sf").attr("type", "hidden");
                        d3.select("#lblsf").style("display", "none");
                    }else if (this.selectedIndex === 3) {
                        d3.select("#period").attr("type", "text").attr("value", "10");
                        d3.select("#lblperiod").style("display", "block").text("Dimension:");
                        d3.select("#sf").attr("type", "text").attr("value", "1.05");
                        d3.select("#lblsf").style("display", "block");
                    } else {
                        d3.select("#period").attr("type", "text");
                        d3.select("#lblperiod").style("display", "block").text("Period (days):");
                        d3.select("#sf").attr("type", "hidden");
                        d3.select("#lblsf").style("display", "none");
                    }
                })
            .selectAll("option")
                .data(["Centered Moving Average","Piecewise Aggregate Approximation", "Sampling", "Clustering"])
                .enter()
                .append("option")
                .attr("value",function (d) { return d;})
                .text(function (d) { return d;});

            form.append("label")
                .attr("id", "lblperiod")
                .attr("for", "period")
                .text("Period (days):");

            form.append("input")
                .attr("type", "text")
                .attr("id", "period");

            form.append("label")
                .attr("id", "lblsf")
                .style("display", "none")
                .attr("for", "sf")
                .text("Scaling factor:");

            form.append("input")
                .attr("type", "hidden")
                .attr("id", "sf");

            form.append("input")
                .attr("type", "button")
                .attr("name", "Show")
                .attr("id", "show")
                .attr("value", "Show")
                .on("click", function() {
                    if (f === 0) {
                        dived3.mining.movingavg(g, data, v, +document.getElementById("period").value);
                    } else if (f === 1) {
                        dived3.mining.paa(g, data, v, +document.getElementById("period").value);
                    } else if (f === 2) {
                        dived3.mining.sampling(g, data, v, +document.getElementById("period").value);
                    } else if (f === 3) {
                        dived3.mining.clustering(g, data, v, +document.getElementById("period").value, +document.getElementById("sf").value);
                    }
                });

            form.attr("onsubmit", "show.click(); return false;")
        });

        function submit() {

        }
    }

    return controls;
}

/* Tooltip implementation
 * tooltip.js
 */

dived3.tooltip.create = function() {
    d3.select("body").append("div")
        .classed("dived3 dived-tooltip", true)
        .style("opacity", 1e-6);
}

dived3.tooltip.show = function (obj, colour, graphType, name, date, value, hourly) {

    switch (graphType) {
        case 1:
            d3.select(obj).transition()
                .duration(200)
                .style("fill-opacity", 1);
            break;
        case 2:
            d3.select(obj).transition()
                .duration(200)
                .attr("r", 8);
            break;
        case 3:
            d3.select(obj).transition()
                .duration(200)
                .style("fill", colour);
            break;
    }

    // Display hours for hourly data, only day otherwise
    var tooltipFormat = hourly ? d3.time.format("%a, %d %b %Y <br/> %I:%M %p") : d3.time.format("%a, %d %b %Y");

    d3.select(".dived3.dived-tooltip")
        .html("<b>" + name + "</b><br/>" + tooltipFormat(date) + "</b> <br/> " + value)
        .style("left", (d3.event.pageX + 8) + "px")
        .style("top", (d3.event.pageY + 3) + "px")
        .style("height", function() { return hourly ? "70px" : "50px";})
        .transition().duration(50)
        .style("opacity", "1");

}

dived3.tooltip.hide = function (obj, colour, graphType) {

    switch (graphType) {
        case 1:
            d3.select(obj).transition()
                .duration(200)
                .style("fill-opacity", 0);
            break;
        case 2:
            d3.select(obj).transition()
                .duration(200)
                .attr("r", 2);
            break;
        case 3:
            d3.select(obj).transition()
                .duration(200)
                .style("fill", colour);
            break;
    }

    d3.select(".dived3.dived-tooltip")
        .transition()
        .duration(200)
        .style("opacity", 1e-6);
}

/* Highlighting and Selecting variables via legend and axes
 * emphasis.js
 */

dived3.emphasis.highlight = function(graphID, varsConfig, varsToHighlight) {

    var plot = d3.select(".dived-graph-" + graphID).select(".dived-plot");
    var opacity;

    varsConfig.forEach(function (v) {
        if (!varsToHighlight.length)
            opacity = v.selected ? 1 : 0.1;
        else
            opacity = varsToHighlight.indexOf(v.index) === -1 ? 0.4 : 1;

        plot.selectAll(".dived-id" + v.index)
            .transition()
            .duration(200)
            .attr("opacity", opacity);

    });

    d3.selectAll(".dived-legend-" + graphID).select("rect")
        .transition()
        .duration(200)
        .style("fill-opacity", function (d, i) {
            // if no variables provided to highlight, highlight based on whether variable is selected
            if (!varsToHighlight.length) return varsConfig[i].selected ? 1 : 0;
            // else just highlight all variables provided
            else return varsToHighlight.indexOf(varsConfig[i].selected) === -1 ? 0 : 1;
        });
}

dived3.emphasis.undoHighlight = function(graphID, varsConfig) {
    var plot = d3.select(".dived-graph-" + graphID).select(".dived-plot");
    var opacity;

    varsConfig.forEach(function (v) {
        opacity = v.selected === true || dived3.graphs[graphID].noneSelected() ? 1 : 0.1;

        plot.selectAll(".dived-id" + v.index)
            .transition()
            .duration(200)
            .attr("opacity", opacity);
    });

    d3.selectAll(".dived-legend-" + graphID).select("rect")
        .transition()
        .duration(200)
        .style("fill-opacity", function (d, i) {
            return varsConfig[i].selected || dived3.graphs[graphID].noneSelected() ? 1 : 0;
        });
}


dived3.emphasis.select = function(graphID, varsConfig, varsToSelect) {
    var noneSelected = true;

    varsConfig.forEach(function (v) {
        if (varsToSelect.indexOf(v.index) !== -1) { // v is in varsToSelect array, toggle select bool
            v.selected = !v.selected;
        }

        if (v.selected && noneSelected) noneSelected = false;
    });

    dived3.graphs[graphID].noneSelected(noneSelected);

    d3.selectAll(".dived-legend-" + graphID).select("rect")
        .style("stroke", function (d, i) {
            return varsConfig[i].selected ? dived3.utils.colourH(i) : dived3.utils.colour(i);
        });

    dived3.emphasis.highlight(graphID, varsConfig, []);
}
/* Data mining functionality
 * mining.js
 */

dived3.mining.movingavg = function (graphID, data, variable, period) {

    var xScale = dived3.graphs[graphID].xScale();
    var yScale = dived3.graphs[graphID].yScale()[0].scale; //TODO get correct scale for var
    if (period % 2 === 0) period++;
    console.log(period, xScale, yScale);

    var avgDataset = [];


    data.forEach(function (d, i) {
        var value = 0;

        if (i >= Math.floor(period / 2) + 1 && i <= data.length - Math.floor(period / 2) - 1) {
            for (var j = i - Math.floor(period / 2); j <= i + Math.floor(period / 2); j++) {
                value += data[j].phenomena[variable].value;
            }
            avgDataset.push({time: d.time, value: value / period});
        }
    });

    dived3.mining.drawLine(graphID, avgDataset, variable, xScale, yScale);

}

dived3.mining.paa = function (graphID, data, variable, period) {

    var xScale = dived3.graphs[graphID].xScale();
    var yScale = dived3.graphs[graphID].yScale()[0].scale; //TODO get correct scale for var
    if (period < 1) period = 1;

    var avgDataset = [];

    for (var i = 0; i < data.length - period; i += period) {
        var mean = d3.mean(data.filter(function (d, j) {if (j >= i && j < i + period) return d;}),
            function (d) {return d.phenomena[variable].value;});

        avgDataset.push({time: data[i + Math.floor(period / 2)].time, value: mean});
    }

    dived3.mining.drawLine(graphID, avgDataset, variable, xScale, yScale);

}

dived3.mining.sampling = function (graphID, data, variable, period) {

    var xScale = dived3.graphs[graphID].xScale();
    var yScale = dived3.graphs[graphID].yScale()[0].scale; //TODO get correct scale for var
    if (period < 1) period = 1;

    var newDataset = [];

    for (var i = 0; i < data.length; i += period) {
        newDataset.push({time: data[i].time, value: data[i].phenomena[variable].value});

        if (i + period > data.length && i < data.length) { //if next iteration will exit loop and skip the end of the dataset
            newDataset.push({time: data[data.length - 1].time, value: data[data.length - 1].phenomena[variable].value});
        }
    }

    dived3.mining.drawLine(graphID, newDataset, variable, xScale, yScale);
}

dived3.mining.clustering = function (graphID, data, variable, d, sf) {

    //Create gridcells
    var gridCells = [];
    var ellipses = [];
    var dim = d;
    var sf = sf;
    var chi = 5.991;

    var plot = d3.select(".dived-graph-" + graphID).select(".dived-plot");
    plot.selectAll(".dived-ellipse").remove();
    var xScale = dived3.graphs[graphID].xScale();
    var yScale = dived3.graphs[graphID].yScale()[0].scale; //TODO get correct scale for var
    var yMax = BigNumber(yScale.domain()[1]);
    var xMax = BigNumber(xScale.domain()[1].getTime());

    var ar = (yMax.div(540)).div((xMax.div(1120))); //aspect ratio
    var p = 4; //precision for dps


    var minX = d3.min(data, function (d) {return d.time;}),
        maxX = new Date(d3.max(data,function (d) {return d.time;}).getTime() + 1),
        stepX = (maxX - minX) / dim;

    var minY = 0,
        maxY = d3.max(data, function (d) { return d.phenomena[0].value; }) + 1,
        stepY = (maxY - minY) / dim;

    var row = 0;
    for (var i = 0; i < dim * dim; i++) {
        if (i === 0) { // very first gridcell
            gridCells.push({
                x0:     minX,
                x1:     new Date(minX.getTime() + stepX),
                y0:     minY,
                y1:     minY + stepY,
                values: [],
                r:      0
            });
        } else if (i % dim !== 0) {
            gridCells.push({ // if i isn't divisible by dim, next gridcell is same row but next column to the right
                x0:     gridCells[i - 1].x1,
                x1:     new Date(gridCells[i - 1].x1.getTime() + stepX),
                y0:     gridCells[i - 1].y0,
                y1:     gridCells[i - 1].y1,
                values: [],
                r:      0
            });
        } else {
            row++; // otherwise, next gridcell is one row higher but first coloumn
            gridCells.push({
                x0:     minX,
                x1:     new Date(minX.getTime() + stepX),
                y0:     minY + stepY * row,
                y1:     minY + stepY * row + stepY,
                values: [],
                r:      0
            });
        }
    }

    // Populate gridcells with datapoints
    var gridX = d3.time.scale()
        .domain([minX, maxX])
        .range([0, dim]);

    var gridY = d3.scale.linear()
        .domain([0, maxY])
        .range([0, dim]);

    data.forEach(function (d, i) {
        var gridIndex = Math.floor(gridX(d.time)) + Math.floor(gridY(d.phenomena[0].value)) * dim;
        gridCells[gridIndex].values.push(d);
    });


    // remove empty cells or cells with only 1 value (can't compute variances)
    for (var i = gridCells.length - 1; i >= 0; i--) {
        if (gridCells[i].values.length < 2) { 
            gridCells.splice(i, 1);
        }
    }

    var avg = data.length / gridCells.length; // average number of points in each cell

    var variance = 0;
    gridCells.forEach(function (g) {
        variance += Math.pow((g.values.length - avg), 2); 
    });

    variance /= gridCells.length;

    var stdev = Math.sqrt(variance);

    console.log(avg, stdev, variance);

    // remove cells with cardinality 1 stdev less than avg
    for (var i = gridCells.length - 1; i >= 0; i--) {
        if (gridCells[i].values.length < avg - stdev) { 
            gridCells.splice(i, 1);
        }
    }


    console.log(gridCells[0]);
    gridCells.forEach(function (g, i) {

        ellipses.push({});
        var e = ellipses.length - 1;

        var n = g.values.length; 

        console.log("Gridcell", i, n);

        var mx = BigNumber(0);
        var my = BigNumber(0);
        g.values.forEach(function (d) { 
            mx = mx.plus(+d.time);
            my = my.plus(d.phenomena[0].value);
        });

        mx = mx.div(n);
        my = my.div(n);

        //console.log("mx, my", mx.valueOf(), my.valueOf());

        var covxy = BigNumber(0),
            covxx = BigNumber(0),
            covyy = BigNumber(0);

        g.values.forEach(function (d, i) { 
            covxy = covxy.plus((mx.negated().plus(+d.time).times(my.negated().plus(d.phenomena[0].value))));
            covxx = covxx.plus((mx.negated().plus(+d.time)).toPower(2));
            covyy = covyy.plus((my.negated().plus(d.phenomena[0].value)).toPower(2));
        });
        // (X - ux) x ( Y - uy)
        covxy = covxy.div(n);
        covxx = covxx.div(n);
        covyy = covyy.div(n);
        console.log(covxx.toExponential(), covyy.toExponential(), covxy.toExponential());

        //console.log("covxy, covxx, covyy", covxy.valueOf(), covxx.valueOf(), covyy.valueOf());

        var det = covxx.times(covyy).minus(covxy.times(covxy)); //determinant

        ellipses[e].mx = mx;
        ellipses[e].my = my;
        ellipses[e].xx = covxx;
        ellipses[e].yy = covyy;
        ellipses[e].xy = covxy;
        ellipses[e].covinv = [
            [covyy.div(det)           , covxy.negated().div(det)],
            [covxy.negated().div(det) , covxx.div(det)          ]
        ];
        ellipses[e].rx = 0;
        ellipses[e].ry = 0;
        ellipses[e].theta = 0;
        ellipses[e].values = [];
        ellipses[e].enlarge = true;
        ellipses[e].delete = false;

        console.log(det.toFixed(4));
        console.log(covxx.toFixed(4), covyy.toFixed(4), covxy.toFixed(4));

        console.log(ellipses[e].covinv[0][0].valueOf(), ellipses[e].covinv[0][1].valueOf(), ellipses[e].covinv[1][1].valueOf());


    });

    var enlarging = true;
    console.log(ellipses);


    data.forEach(function (d, i) {
        ellipses.forEach(function (e, j) {
            //[00 01] [00 01  [00
            //         10 11]  01]
            var m = [e.mx.negated().plus(+d.time), e.my.negated().plus(d.phenomena[0].value)];
            var a = [ m[0].times(e.covinv[0][0]).plus(m[1].times(e.covinv[1][0])), m[0].times(e.covinv[0][1]).plus(m[1].times(e.covinv[1][1]))];
            var b = a[0] * m[0] + a[1] * m[1];

            if (b < chi) {
                e.values.push(d);
            }

        })
    });


    chi = 4.605;
    var oldlength;
    var index = 0;


    while (enlarging && index < 20) {
        enlarging = false;
        oldlength = [];

        ellipses.forEach(function (e, i) {
            oldlength.push(e.values.length);

            if (e.enlarge) {
                //console.log("enlarging " + i);
                e.xx = e.xx.times(sf);
                e.yy = e.yy.times(sf);
                e.xy = e.xy.times(sf);

                var det = e.xx.times(e.yy).minus(e.xy.times(e.xy));
                e.covinv = [
                    [e.yy.div(det)           , e.xy.negated().div(det)],
                    [e.xy.negated().div(det) , e.xx.div(det)          ]
                ];
            }

        });

        data.forEach(function (d, i) {
            ellipses.forEach(function (e, j) {
                //[00 01] [00 01  [00
                //         10 11]  01]
                var m = [e.mx.negated().plus(+d.time), e.my.negated().plus(d.phenomena[0].value)];
                var a = [ m[0].times(e.covinv[0][0]).plus(m[1].times(e.covinv[1][0])), m[0].times(e.covinv[0][1]).plus(m[1].times(e.covinv[1][1]))];
                var b = a[0] * m[0] + a[1] * m[1];

                if (b < chi && e.values.indexOf(d) === -1) {
                    e.values.push(d);
                }
            });
        });

        // if (index < 2) console.log(eligible);

        //        eligible.forEach(function(e) {
        //            var max = e[0];
        //            e.forEach(function(d) {
        //                if (oldlength[d] > oldlength[max]) {
        //                    max = d;
        //                }
        //            });
        //            ellipses[max].values.push(data[e]);
        //        });

        index++;

        ellipses.forEach(function (e, i) {
            if (e.enlarge) {
                var n = e.values.length;
                var t = Math.round(oldlength[i] + oldlength[i] / 19); //threshold

                var mx = BigNumber(0);
                var my = BigNumber(0);
                e.values.forEach(function (d) {
                    mx = mx.plus(+d.time);
                    my = my.plus(d.phenomena[0].value);
                });

                mx = mx.div(n);
                my = my.div(n);

                var covxy = BigNumber(0),
                    covxx = BigNumber(0),
                    covyy = BigNumber(0);

                e.values.forEach(function (d, i) {
                    covxy = covxy.plus(((d.time - mx) * (d.phenomena[0].value - my)).toFixed(p));
                    covxx = covxx.plus(((d.time - mx) * (d.time - mx)).toFixed(p));
                    covyy = covyy.plus(((d.phenomena[0].value - my) * (d.phenomena[0].value - my)).toFixed(p));
                });

                covxy = covxy.div(n);
                covxx = covxx.div(n);
                covyy = covyy.div(n);

                e.mx = mx;
                e.my = my;
                e.xy = covxy;
                e.xx = covxx;
                e.yy = covyy;

                var det = e.xx.times(e.yy).minus(e.xy.times(e.xy)); //determinant
                e.covinv = [
                    [e.yy.div(det)           , e.xy.negated().div(det)],
                    [e.xy.negated().div(det) , e.xx.div(det)          ]
                ];

                console.log("ellipse", i, "n", n, "old", oldlength[i], "t", t);
                if (n <= t || n === 0) {
                    console.log("stopping " + i);
                    e.enlarge = false;
                } else {
                    console.log("true enalrge");
                    enlarging = true;
                }
            }
        });
        console.log(index + "th pass");
    }


    var threshold = Math.sqrt(2) / 2 * (1120 / dim);

    ellipses.forEach(function (e, i) {

        for (var j = i + 1; j < ellipses.length; j++) {
            //console.log("distance between " + i + " and " + j + " is " + Math.sqrt(Math.pow(xScale(e.mx)-xScale(ellipses[j].mx),2) + Math.pow(yScale(e.my) - yScale(ellipses[j].my),2)));

            if (Math.sqrt(Math.pow(xScale(e.mx.toFixed(p)) - xScale(ellipses[j].mx.toFixed(p)), 2) + Math.pow(yScale(e.my.toFixed(p)) - yScale(ellipses[j].my.toFixed(p)), 2)) < threshold) {
                console.log("i " + i + " and j " + j + " are too close");
                if (e.values.length < ellipses[j].values.length) {
                    e.delete = true;
                } else {
                    ellipses[j].delete = true;
                }

            }
        }

    });

    for (i = ellipses.length - 1; i >= 0; i--) {
        if (ellipses[i].delete === true)
            ellipses.splice(i, 1);
    }

    var included;
    var distances;
    data.forEach(function (d, index) {
        included = [];
        distances = [];
        ellipses.forEach(function (e, j) {
            if (e.values.indexOf(d) !== -1) {
                included.push(j);
            }
        });

        if (included.length > 1) {
            included.forEach(function (i) {
                var dist = Math.sqrt(Math.pow(xScale(d.time) - xScale(ellipses[i].mx.toFixed(p)), 2) + Math.pow(yScale(d.phenomena[0].value) - yScale(ellipses[i].my.toFixed(p)), 2));
                distances.push([i, dist]);
            });

            var minD = 0;
            var minI = 0;

            distances.forEach(function (distance) {
                if (distance[1] > minD) {
                    minD = distance[1];
                    minI = distance[0];
                }
            });

            distances.forEach(function (distance) {
                if (distance[0] !== minI) {
                    console.log("deleting");
                    ellipses[distance[0]].values.splice(ellipses[distance[0]].values.indexOf(d), 1);
                }
            });
            //var mini = distances.indexOf(d3.min(distances, function(d) { return d.dist; } ));
            console.log("point ", index, " included in ", distances.length, "ellipses, closest to ", minI);
        }

    });

    ellipses.forEach(function (e, i) {
        var n = e.values.length;

        var mx = BigNumber(0);
        var my = BigNumber(0);
        e.values.forEach(function (d) {
            mx = mx.plus(+d.time);
            my = my.plus(d.phenomena[0].value);
        });

        mx = mx.div(n);
        my = my.div(n);

        var covxy = BigNumber(0),
            covxx = BigNumber(0),
            covyy = BigNumber(0);

        e.values.forEach(function (d, i) {
            covxy = covxy.plus(((d.time - mx) * (d.phenomena[0].value - my)).toFixed(p));
            covxx = covxx.plus(((d.time - mx) * (d.time - mx)).toFixed(p));
            covyy = covyy.plus(((d.phenomena[0].value - my) * (d.phenomena[0].value - my)).toFixed(p));
        });

        covxy = covxy.div(n);
        covxx = covxx.div(n);
        covyy = covyy.div(n);

        e.mx = mx;
        e.my = my;
        e.xy = covxy;
        e.xx = covxx;
        e.yy = covyy;

        var det = e.xx.times(e.yy).minus(e.xy.times(e.xy)); //determinant
        e.covinv = [
            [e.yy.div(det)           , e.xy.negated().div(det)],
            [e.xy.negated().div(det) , e.xx.div(det)          ]
        ];
    });

    ellipses.forEach(function (e, i) {
        //var t = d3.sum(e.values, function(d) { console.log(d); return 1; });
        var mx = d3.mean(e.values, function (d) { return xScale(d.time);});
        var my = d3.mean(e.values, function (d) { return yScale(d.phenomena[0].value);});

        var xy = d3.mean(e.values, function (d) { return (xScale(d.time) - mx) * (yScale(d.phenomena[0].value) - my);});
        var xx = d3.mean(e.values, function (d) { return (xScale(d.time) - mx) * (xScale(d.time) - mx); });
        var yy = d3.mean(e.values, function (d) { return (yScale(d.phenomena[0].value) - my) * (yScale(d.phenomena[0].value) - my); });

        /*
         ax^2 + bx + c = 0
         x = (-b +- sqrt(b^2-4ac))/2a - quadratic formula

         [xx xy
         xy yy] = covariance matrix
         eigval l = l^2 - (xx+yy)l + (xx*yy - xy^2)
         a = 1, b = -(xx+yy), c = xx*yy - xy^2, solve for l to find eigenvalues
         */


        //        var a = BigNumber(1);
        //        var b = e.xx.negated().minus(e.yy);
        //        var c = e.xx.times(e.yy).minus(e.xy.times(e.xy)); //determinant

        var a = 1;
        var b = -xx - yy;
        var c = (xx * yy) - (xy * xy);

        var l1 = (-b + (Math.sqrt(b * b - 4 * a * c))) / (2 * a);
        var l2 = (-b - (Math.sqrt(b * b - 4 * a * c))) / (2 * a);
        //console.log("a,b,c", a.valueOf(), b.valueOf(), c.valueOf());

        //eigenvalues
        //        var l1 = b.negated().plus((b.times(b).minus(c.times(4))).squareRoot()).div(2);
        //        var l2 = b.negated().minus((b.times(b).minus(c.times(4))).squareRoot()).div(2);

        //console.log("l1,l2", l1.valueOf(), l2.valueOf());

        var rx, ry;

        if (xx > yy) {
            if (l1 > l2) {
                rx = Math.sqrt(l1) * 2.4477;
                ry = Math.sqrt(l2) * 2.4477;
            } else {
                rx = Math.sqrt(l2) * 2.4477;
                ry = Math.sqrt(l1) * 2.4477;
            }
        } else {
            if (l1 > l2) {
                rx = Math.sqrt(l2) * 2.4477;
                ry = Math.sqrt(l1) * 2.4477;
            } else {
                rx = Math.sqrt(l1) * 2.4477;
                ry = Math.sqrt(l2) * 2.4477;
            }
        }


        console.log("rx", rx, "ry", ry);

        var theta = (0.5 * Math.atan(( (xy * 2) / (xx - yy) ))) * (180 / 3.1415);


        //var theta = (0.5 * Math.atan( e.xy.times(2).div(e.xx.times(ar).minus(e.yy.div(ar)) ))) * (180 / 3.1415);


        if (i == 7) {
            console.log(e.values);
            console.log("xy", e.xy.toFixed(1));
            console.log("xx", e.xx.toFixed(1));
            console.log("yy", e.yy.toFixed(1));
            console.log(theta);
            console.log("ar", ar);
        }
        e.rx = rx;
        e.ry = ry;
        e.theta = theta;
    });

    plot.selectAll(".dived-grid").remove();

    //visualise
//    gridCells.forEach(function (g, i) {
//
//        var rect = plot.append("g");
//        rect
//            .append("rect")
//            .classed("dived dived-grid", true)
//            .attr("x", function () { return xScale(g.x0);})
//            .attr("y", function () { return yScale(g.y1);})
//            .attr("width", function () { return 1120 / dim;})
//            .attr("height", function () { return  yScale(g.y0) - yScale(g.y1);})
//            .attr("stroke", "red")
//            .attr("stroke-width", "1px")
//            .attr("fill-opacity", "0")
//            .attr("stroke-opacity", "0.5");
//        rect
//            .append("text")
//            .classed("dived dived-grid", true)
//            .attr("x", function () { return xScale(g.x0);})
//            .attr("y", function () { return yScale(g.y1) + 10;})
//            .text(function () { return i;});
//
//        //        plot.append("circle").attr("cx",function () { return xScale(g.x0);}).attr("cy",function () { return yScale(g.y0);}).attr("r", "2").attr("fill", "red");
//        //        plot.append("circle").attr("cx",function () { return xScale(g.x0);}).attr("cy",function () { return yScale(g.y1);}).attr("r", "2").attr("fill", "red");
//        //        plot.append("circle").attr("cx",function () { return xScale(g.x1);}).attr("cy",function () { return yScale(g.y0);}).attr("r", "2").attr("fill", "red");
//        //        plot.append("circle").attr("cx",function () { return xScale(g.x1);}).attr("cy",function () { return yScale(g.y1);}).attr("r", "2").attr("fill", "red");
//    });


    var clusters = plot
        .selectAll(".dived-cluster")
        .data(ellipses);

    clusters
        .enter()
        .append("ellipse");


    clusters
        .classed("dived dived-cluster", true)
        .attr("cx", function (d) {
            return xScale(d.mx);
        })
        .attr("cy", function (d) { return yScale(d.my);})
        .attr("rx", function (d) { return d.rx;})
        .attr("ry", function (d) { return d.ry;})
        .attr("fill", "orange")
        .attr("fill-opacity", "0.2")
        .attr("stroke", "red")
        .attr("stroke-width", "2px")
        .attr("transform", function (d) { return "rotate(" + (d.theta) + " " + xScale(d.mx) + " " + yScale(d.my) + ")";});

    clusters.exit().remove();

    var clusterValues = [];
    var mapped = ellipses.map(function (d) {
        return d.phenomena;
    });
    //clusterValues = clusterValues.concat.apply(clusterValues, mapped);

    //console.log(mapped, clusterValues);
    plot.selectAll(".clusterMean")
        .data(ellipses)
        .enter()
        .append("circle")
        .classed("dived dived-grid", true)
        .attr("cx", function (d) { return xScale(d.mx);})
        .attr("cy", function (d) { return yScale(d.my);})
        .attr("r", "5")
        .attr("fill", "red")
        .on("mousemove", function (d, i) {
            dived3.tooltip.show(d3.event.target, dived3.utils.colourH(0), 2, "Ellipse", new Date(d.mx), i, false);
        })
        .on("mouseout", function (d) {
            dived3.tooltip.hide(d3.event.target, "red", 2);
        });

    plot.selectAll("dived-circles")
        .data(clusterValues)
        .enter()
        .append("circle")
        .classed("dived dived-grid", true)
        .attr("cx", function (d) {
            return xScale(d.time);
        })
        .attr("cy", function (d) {
            return yScale(d.phenomena[0].value);
        })
        .attr("r", "3")
        .style("fill", function (d) { return dived3.utils.colour(2);})
        .style("fill-opacity", "1");

}


dived3.mining.drawLine = function (graphID, data, variable, xScale, yScale) {
    var plot = d3.select(".dived-graph-" + graphID).select(".dived-plot");

    var line = d3.svg.line()
        .x(function (d) { return xScale(d.time); })
        .y(function (d) { return yScale(d.value); });

    var path = plot.selectAll(".dived-avg")
        .data([data]);

    path
        .enter()
        .append("path");

    path
        .classed("dived3 dived-line dived-avg", true)
        .attr("stroke", function (d) { return dived3.utils.colourM(1); })
        .style("pointer-events", "none")
        .attr("interpolate", "linear")
        .transition()
        .duration(400)
        .ease("linear")
        .attr("d", line);

    path.exit()
        .remove();

    plot.select(".dived-id" + variable).attr("opacity", "0.3");

}

d3.selection.prototype.moveToFront = function () {
    return this.each(function () {
        this.parentNode.appendChild(this);
    });
};

/* Normal default colours */
dived3.utils.colour = function(i) {
    var c = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2",
        "#7f7f7f", "#bcbd22", "#17becf"];

    return c[i % c.length];
}

/* Highlight colours for mouseovers */
dived3.utils.colourH = function(i) {
    var c = ["#aec7e8", "#ffbb78", "#98df8a", "#ff9896", "#c5b0d5", "#c49c94", "#f7b6d2",
        "#c7c7c7", "#dbdb8d", "#9edae5"];

    return c[i % c.length];
}

/* Colours for data mining features, eg moving average line */
dived3.utils.colourM = function(i) {
    var c = ["#1EB3A6", "#FF560E", "#96A02C", "#FF2728", "#843c39", "#7b4173"];

    return c[i % c.length];
}
})();