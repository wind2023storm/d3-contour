import {extent, thresholdSturges, ticks} from "d3-array";
import {slice} from "./array";
import constant from "./constant";

var cases = [
  [],
  [[[0.5,1],[1,1.5]]],
  [[[1,1.5],[1.5,1]]],
  [[[0.5,1],[1.5,1]]],
  [[[1,0.5],[1.5,1]]],
  [[[0.5,1],[1,0.5]],[[1,1.5],[1.5,1]]],
  [[[1,0.5],[1,1.5]]],
  [[[0.5,1],[1,0.5]]],
  [[[0.5,1],[1,0.5]]],
  [[[1,0.5],[1,1.5]]],
  [[[0.5,1],[1,1.5]],[[1,0.5],[1.5,1]]],
  [[[1,0.5],[1.5,1]]],
  [[[0.5,1],[1.5,1]]],
  [[[1,1.5],[1.5,1]]],
  [[[0.5,1],[1,1.5]]],
  []
];

export default function() {
  var x0 = 0,
      y0 = 0,
      x1 = 960,
      y1 = 500,
      dx = x1 - x0,
      dy = y1 - y0,
      threshold = thresholdSturges;

  function contours(values) {
    var rings = [], tz = threshold(values);

    // Convert number of thresholds into uniform thresholds.
    if (!Array.isArray(tz)) {
      var domain = extent(values);
      tz = ticks(domain[0], domain[1], tz);
    }

    // Accumulate and smooth contour polygons. TODO Assign holes.
    tz.forEach(function(value) {
      isoline(function(x, y) {
        return x >= x0
            && y >= y0
            && x < x1
            && y < y1
            && values[(y - y0) * dx + (x - x0)] < value;
      }).forEach(function(ring) {
        smooth(ring, values, value);
        rings.push(ring);
      });
    });

    return rings;
  }

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
              f = {start: f.start, end: g.end, ring: f.ring.concat(g.ring)};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else if (g = fragmentByEnd[endIndex]) {
              delete fragmentByStart[f.start];
              delete fragmentByEnd[f.end];
              delete fragmentByEnd[g.end];
              f = {start: g.start, end: f.start, ring: g.ring.concat(f.ring.reverse())};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else {
              delete fragmentByEnd[f.end];
              f.ring.push(end);
              f.end = index(end);
              fragmentByEnd[f.end] = f;
            }
          } else if (f = fragmentByStart[endIndex]) {
            if (g = fragmentByEnd[startIndex]) {
              delete fragmentByStart[f.start];
              delete fragmentByEnd[g.end];
              f = {start: g.start, end: f.end, ring: g.ring.concat(f.ring)};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else if (g = fragmentByStart[startIndex]) {
              delete fragmentByStart[f.start];
              delete fragmentByEnd[f.end];
              delete fragmentByStart[g.start];
              f = {start: f.end, end: g.end, ring: f.ring.reverse().concat(g.ring)};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else {
              delete fragmentByStart[f.start];
              f.ring.unshift(start);
              f.start = index(start);
              fragmentByStart[f.start] = f;
            }
          } else if (f = fragmentByStart[startIndex]) {
            if (g = fragmentByEnd[endIndex]) {
              delete fragmentByStart[f.start];
              delete fragmentByEnd[g.end];
              f = {start: g.start, end: f.end, ring: g.ring.concat(f.ring)};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else { // Note: fragmentByStart[endIndex] is null!
              delete fragmentByStart[f.start];
              f.ring.unshift(end);
              f.start = index(end);
              fragmentByStart[f.start] = f;
            }
          } else if (f = fragmentByEnd[endIndex]) {
            if (g = fragmentByStart[startIndex]) {
              delete fragmentByEnd[f.end];
              delete fragmentByStart[g.start];
              f = {start: f.start, end: g.end, ring: f.ring.concat(g.ring)};
              fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
            } else { // Note: fragmentByEnd[startIndex] is null!
              delete fragmentByEnd[f.end];
              f.ring.push(start);
              f.end = index(start);
              fragmentByEnd[f.end] = f;
            }
          } else {
            f = {start: index(start), end: index(end), ring: [start, end]};
            fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
          }
        });
      }
    }

    for (var k in fragmentByEnd) {
      rings.push(fragmentByEnd[k].ring);
    }

    return rings;
  }

  function index(point) {
    return ((point[0] - x0) << 1) + ((point[1] - y0) << 1) * (dx << 1);
  }

  function smooth(ring, values, value) {
    ring.forEach(function(point) {
      var x = point[0] - x0, y = point[1] - y0, xt = x | 0, yt = y | 0, v0, v1;
      if (x > 0 && x < dx && xt === x) {
        v0 = values[yt * dx + x - 1];
        v1 = values[yt * dx + x];
        point[0] = x + (value - v0) / (v1 - v0);
      }
      if (y > 0 && y < dy && yt === y) {
        v0 = values[(y - 1) * dx + xt];
        v1 = values[y * dx + xt];
        point[1] = y + (value - v0) / (v1 - v0);
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
