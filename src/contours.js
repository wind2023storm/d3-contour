import {extent, thresholdSturges, tickStep, range} from "d3-array";
import {slice} from "./array";
import area from "./area";
import constant from "./constant";
import contains from "./contains";

var cases = [
  [],
  [[[1,1.5],[0.5,1]]],
  [[[1.5,1],[1,1.5]]],
  [[[1.5,1],[0.5,1]]],
  [[[1,0.5],[1.5,1]]],
  [[[1,0.5],[0.5,1]],[[1,1.5],[1.5,1]]],
  [[[1,0.5],[1,1.5]]],
  [[[1,0.5],[0.5,1]]],
  [[[0.5,1],[1,0.5]]],
  [[[1,1.5],[1,0.5]]],
  [[[0.5,1],[1,1.5]],[[1.5,1],[1,0.5]]],
  [[[1.5,1],[1,0.5]]],
  [[[0.5,1],[1.5,1]]],
  [[[1,1.5],[1.5,1]]],
  [[[0.5,1],[1,1.5]]],
  []
];

function ascending(a, b) {
  return a - b;
}

export default function() {
  var x0 = 0,
      y0 = 0,
      x1 = 960,
      y1 = 500,
      dx = x1 - x0,
      dy = y1 - y0,
      threshold = thresholdSturges;

  function contours(values) {
    var tz = threshold(values);

    // Convert number of thresholds into uniform thresholds.
    if (!Array.isArray(tz)) {
      var domain = extent(values), start = domain[0], stop = domain[1];
      tz = tickStep(start, stop, tz);
      tz = range(Math.floor(start / tz) * tz, Math.floor(stop / tz) * tz, tz);
    } else {
      tz = tz.slice().sort(ascending);
    }

    // Accumulate, smooth contour rings, assign holes to exterior rings.
    // Based on https://github.com/mbostock/shapefile/blob/v0.6.2/shp/polygon.js
    var layers = tz.map(function(value) {
      var polygons = [],
          holes = [];

      // TODO Inline the test function to improve performance.
      // TODO Move the bounds-checking outside of the test function.
      // TODO Fix the beveling that occurs on the canvas corners?
      isoline(function(x, y) {
        return x >= x0
            && y >= y0
            && x < x1
            && y < y1
            && values[(y - y0) * dx + (x - x0)] >= value
      }).forEach(function(ring) {
        smooth(ring, values, value);
        if (area(ring) > 0) polygons.push([ring]);
        else holes.push(ring);
      });

      holes.forEach(function(hole) {
        for (var i = 0, n = polygons.length, polygon; i < n; ++i) {
          if (contains((polygon = polygons[i])[0], hole)) {
            polygon.push(hole);
            return;
          }
        }
      });

      return polygons;
    });

    return layers.map(function(polygons, i) {
      return {
        type: "MultiPolygon",
        value: tz[i],
        coordinates: polygons
      };
    });
  }

  // Marching squares with isolines stitched into rings.
  // Based on https://github.com/topojson/topojson-client/blob/v3.0.0/src/stitch.js
  function isoline(test) {
    var rings = [],
        fragmentByStart = new Array,
        fragmentByEnd = new Array;

    for (var y = y0 - 1; y < y1; ++y) {
      for (var x = x0 - 1; x < x1; ++x) {
        cases[(test(x, y + 1) << 0)
            | (test(x + 1, y + 1) << 1)
            | (test(x + 1, y) << 2)
            | (test(x, y) << 3)].forEach(function(line) {
          var start = [line[0][0] + x, line[0][1] + y], startIndex = index(start),
              end = [line[1][0] + x, line[1][1] + y], endIndex = index(end),
              f, g;
          if (f = fragmentByEnd[startIndex]) {
            if (g = fragmentByStart[endIndex]) {
              delete fragmentByEnd[f.end];
              delete fragmentByStart[g.start];
              if (f === g) {
                f.ring.push(end);
                rings.push(f.ring);
              } else {
                fragmentByStart[f.start] = fragmentByEnd[g.end] = {start: f.start, end: g.end, ring: f.ring.concat(g.ring)};
              }
            } else {
              delete fragmentByEnd[f.end];
              f.ring.push(end);
              fragmentByEnd[f.end = endIndex] = f;
            }
          } else if (f = fragmentByStart[endIndex]) {
            if (g = fragmentByEnd[startIndex]) {
              delete fragmentByStart[f.start];
              delete fragmentByEnd[g.end];
              if (f === g) {
                f.ring.push(end);
                rings.push(f.ring);
              } else {
                fragmentByStart[g.start] = fragmentByEnd[f.end] = {start: g.start, end: f.end, ring: g.ring.concat(f.ring)};
              }
            } else {
              delete fragmentByStart[f.start];
              f.ring.unshift(start);
              fragmentByStart[f.start = startIndex] = f;
            }
          } else {
            fragmentByStart[startIndex] = fragmentByEnd[endIndex] = {start: startIndex, end: endIndex, ring: [start, end]};
          }
        });
      }
    }

    return rings;
  }

  function index(point) {
    return ((point[0] - x0) << 1) + ((point[1] - y0) << 1) * (dx << 1);
  }

  // Linear interpolation of contour points.
  function smooth(ring, values, value) {
    ring.forEach(function(point) {
      var x = point[0] - x0, y = point[1] - y0, xt = x | 0, yt = y | 0, v0, v1;
      if (x > 0 && x < dx && xt === x) {
        v0 = values[yt * dx + x - 1];
        v1 = values[yt * dx + x];
        point[0] = x - 0.5 + (value - v0) / (v1 - v0);
      }
      if (y > 0 && y < dy && yt === y) {
        v0 = values[(y - 1) * dx + xt];
        v1 = values[y * dx + xt];
        point[1] = y - 0.5 + (value - v0) / (v1 - v0);
      }
    });
  }

  contours.size = function(_) {
    return arguments.length ? contours.extent([[0, 0], _]) : [dx, dy];
  };

  contours.extent = function(_) {
    if (!arguments.length) return [[x0, y0], [x1, y1]];
    var _00 = Math.floor(_[0][0]), _01 = Math.floor(_[0][1]), _10 = Math.ceil(_[1][0]), _11 = Math.ceil(_[1][1]);
    if (!(_10 >= _00) || !(_11 >= _01)) throw new Error("invalid extent");
    dx = (x1 = _10) - (x0 = _00);
    dy = (y1 = _11) - (y0 = _01);
    return contours;
  };

  contours.thresholds = function(_) {
    return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? constant(slice.call(_)) : constant(_), contours) : threshold;
  };

  return contours;
}
