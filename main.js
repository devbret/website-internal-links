function idOf(x) {
  return typeof x === "string" ? x : x?.id;
}

const statusColor = d3
  .scaleOrdinal()
  .domain(["2xx", "3xx", "4xx", "5xx", "other"])
  .range(["aqua", "#f59e0b", "#ef4444", "#a855f7", "#64748b"]);

function statusBucket(code) {
  if (!code) return "other";
  const s = String(code);
  const head = +s[0];
  return { 2: "2xx", 3: "3xx", 4: "4xx", 5: "5xx" }[head] || "other";
}

const isGreen = (d) => statusBucket(d.status_code) === "2xx";
const GREEN_FADE_OPACITY = 0.25;

let currentlySelectedNode = null;

d3.json("links.json")
  .then(function (site_structure) {
    if (!site_structure || Object.keys(site_structure).length === 0) {
      console.warn("links.json is empty or invalid. Cannot render graph.");
      d3.select("body").append("p").text("No crawl data available to display.");
      return;
    }

    const nodes = [];
    const links = [];

    function getNodeData(url) {
      const data = site_structure[url] || {};
      return {
        id: url,
        title: data.title || "",
        meta_description: data.meta_description || "",
        meta_keywords: data.meta_keywords || "",
        h1_tags: data.h1_tags || [],
        word_count: data.word_count || 0,
        status_code: data.status_code || "",
        response_time: data.response_time || 0,
        readability_score: data.readability_score || 0,
        sentiment: data.sentiment || 0,
        keyword_density: data.keyword_density || {},
        image_count: data.image_count || 0,
        script_count: data.script_count || 0,
        stylesheet_count: data.stylesheet_count || 0,
        has_viewport_meta: data.has_viewport_meta || false,
        heading_count: data.heading_count || 0,
        paragraph_count: data.paragraph_count || 0,
        internal_links: data.internal_links || [],
        external_links: data.external_links || [],
        semantic_elements: data.semantic_elements || {},
        heading_issues: data.heading_issues || [],
        unlabeled_inputs: data.unlabeled_inputs || [],
        images_without_alt: data.images_without_alt || [],
      };
    }

    Object.keys(site_structure).forEach((sourceUrl) => {
      const sourceData = site_structure[sourceUrl];

      if (!nodes.some((node) => node.id === sourceUrl)) {
        nodes.push(getNodeData(sourceUrl));
      }

      if (sourceData && Array.isArray(sourceData.internal_links)) {
        sourceData.internal_links.forEach((targetUrl) => {
          links.push({ source: sourceUrl, target: targetUrl });
          if (!nodes.some((node) => node.id === targetUrl)) {
            nodes.push(getNodeData(targetUrl));
          }
        });
      }
    });

    if (nodes.length === 0) {
      console.warn("No nodes to display in the graph.");
      return;
    }

    const degreeById = (() => {
      const counts = new Map();
      links.forEach((l) => {
        const s = idOf(l.source);
        const t = idOf(l.target);
        counts.set(s, (counts.get(s) || 0) + 1);
        counts.set(t, (counts.get(t) || 0) + 1);
      });
      return counts;
    })();

    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3
      .select("body")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const container = svg.append("g");

    const zoomHandler = d3
      .zoom()
      .on("zoom", (event) => container.attr("transform", event.transform));
    svg.call(zoomHandler).call(zoomHandler.transform, d3.zoomIdentity);

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 18)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "magenta");

    const link = container
      .append("g")
      .attr("class", "links")
      .selectAll("path")
      .data(links)
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("fill", "none")
      .attr("marker-end", "url(#arrow)")
      .style("pointer-events", "none");

    const ARROW_URL = "url(#arrow)";

    function showArrowheadsForNeighbors(nodeId) {
      link.attr("marker-end", (l) =>
        idOf(l.source) === nodeId || idOf(l.target) === nodeId
          ? ARROW_URL
          : null
      );
    }

    function restoreAllArrowheads() {
      link.attr("marker-end", ARROW_URL);
    }

    const node = container
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", (d) =>
        Math.max(6, Math.min(24, (degreeById.get(d.id) || 1) * 1.2))
      )
      .attr("fill", (d) => statusColor(statusBucket(d.status_code)))
      .attr("stroke", "black")
      .attr("stroke-width", 1.5)
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", (event, d) => {
        highlightNeighborhood(d.id);
        currentlySelectedNode = d;
      })
      .on("dblclick", (event, d) => {
        window.open(d.id, "_blank");
      })
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    const labels = container
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes)
      .enter()
      .append("text")
      .attr("class", "node-label")
      .attr("font-size", 10)
      .attr("pointer-events", "none")
      .attr("display", "none")
      .text((d) => d.title || new URL(d.id).pathname);

    function groupKey(url) {
      const u = new URL(url);
      const seg = u.pathname.split("/").filter(Boolean)[0] || "/";
      return `${u.hostname}/${seg}`;
    }
    const groups = d3.group(nodes, (d) => groupKey(d.id));
    const groupColor = d3.scaleOrdinal([...groups.keys()], d3.schemeTableau10);
    const hullLayer = container
      .insert("g", ":first-child")
      .attr("class", "hulls")
      .style("pointer-events", "none");

    function drawHulls() {
      const hullData = [...groups].map(([k, arr]) => {
        const pts = d3.polygonHull(
          arr
            .filter((d) => Number.isFinite(d.x) && Number.isFinite(d.y))
            .map((d) => [d.x, d.y])
        );
        return { k, pts };
      });

      const path = hullLayer.selectAll("path").data(
        hullData.filter((h) => h.pts && h.pts.length > 2),
        (d) => d.k
      );

      path
        .enter()
        .append("path")
        .attr("fill", (d) => groupColor(d.k))
        .attr("fill-opacity", 0.06)
        .attr("stroke", (d) => groupColor(d.k))
        .attr("stroke-opacity", 0.4)
        .attr("stroke-width", 1.2)
        .merge(path)
        .attr("d", (d) => "M" + d.pts.join("L") + "Z");

      path.exit().remove();
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(430)
          .strength(0.8)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide()
          .radius((d) => Math.max(10, (degreeById.get(d.id) || 1) + 6))
          .iterations(1)
      )
      .alphaDecay(0.03);

    simulation.on("tick", () => {
      link.attr("d", (d) => {
        const sx = d.source.x,
          sy = d.source.y,
          tx = d.target.x,
          ty = d.target.y;
        const dx = tx - sx;
        const dy = ty - sy;
        const dr = Math.hypot(dx, dy) * 0.6;
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`;
      });

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
      labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y + 4);

      drawHulls();
    });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        svg.attr("width", w).attr("height", h);
        simulation.force("center", d3.forceCenter(w / 2, h / 2));
        simulation.alpha(0.2).restart();
      }, 150);
    });

    function mouseover(event, d) {
      d3.select(this).raise();

      const claudeDiv = document.querySelector("#claude-analysis-section");
      const claudeOutput = document.querySelector("#claude-analysis-output");
      if (claudeDiv && claudeOutput) {
        claudeDiv.style.display = "block";
        claudeOutput.innerHTML = "";
      }

      currentlySelectedNode = d;

      const connectedLinks = links.filter(
        (l) =>
          (l.source.id || l.source) === d.id ||
          (l.target.id || l.target) === d.id
      ).length;

      const keywordDensityFormatted =
        d.keyword_density && Object.keys(d.keyword_density).length > 0
          ? Object.entries(d.keyword_density)
              .filter(([_, density]) => density > 0)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(
                ([keyword, density]) =>
                  `${keyword}: ${(density * 100).toFixed(2)}%`
              )
              .join("<br/>")
          : "N/A";

      const tooltipContent = `
    <li><strong>Title:</strong> ${d.title || "N/A"}</li>
    <li><strong>URL:</strong> <a href="${d.id}" target="_blank">${d.id}</a></li>
    <li><strong>Connections:</strong> ${connectedLinks}</li>
    <li><strong>Meta Description:</strong> ${d.meta_description || "N/A"}</li>
    <li><strong>Meta Keywords:</strong> ${d.meta_keywords || "N/A"}</li>
    <li><strong>H1 Tags:</strong> ${
      d.h1_tags && d.h1_tags.length > 0 ? d.h1_tags.join(", ") : "None"
    }</li>
    <li><strong>Word Count:</strong> ${d.word_count}</li>
    <li><strong>Unigram Density:</strong><br/>${keywordDensityFormatted}</li>
    <li><strong>Readability Score:</strong> ${
      typeof d.readability_score === "number"
        ? d.readability_score.toFixed(2)
        : "N/A"
    }</li>
    <li><strong>Sentiment:</strong> ${
      typeof d.sentiment === "number" ? d.sentiment.toFixed(2) : "N/A"
    }</li>
    <li><strong>Image Count:</strong> ${d.image_count}</li>
    <li><strong>Script Count:</strong> ${d.script_count}</li>
    <li><strong>Stylesheet Count:</strong> ${d.stylesheet_count}</li>
    <li><strong>Has Viewport Meta:</strong> ${
      d.has_viewport_meta ? "Yes" : "No"
    }</li>
    <li><strong>Heading Count:</strong> ${d.heading_count}</li>
    <li><strong>Paragraph Count:</strong> ${d.paragraph_count}</li>
    <li><strong>Status Code:</strong> ${d.status_code || "N/A"}</li>
    <li><strong>Response Time:</strong> ${
      typeof d.response_time === "number"
        ? d.response_time.toFixed(2) + " seconds"
        : "N/A"
    }</li>
    <li><strong>Number Of Internal Links:</strong> ${
      d.internal_links ? d.internal_links.length : 0
    } links</li>
    <li><strong>Number Of External Links:</strong> ${
      d.external_links ? d.external_links.length : 0
    } links</li>
    <li><strong>Semantic Elements:</strong><br/>${
      d.semantic_elements && Object.keys(d.semantic_elements).length > 0
        ? Object.entries(d.semantic_elements)
            .map(([tag, present]) => `${tag}: ${present ? "✔️" : "❌"}`)
            .join("<br/>")
        : "N/A"
    }</li>
    <li><strong>Heading Structure Issues:</strong> ${
      d.heading_issues && d.heading_issues.length > 0
        ? d.heading_issues.map((pair) => `${pair[0]} → ${pair[1]}`).join(", ")
        : "None"
    }</li>
    <li><strong>Unlabeled Inputs:</strong> ${
      d.unlabeled_inputs && d.unlabeled_inputs.length > 0
        ? d.unlabeled_inputs.join(", ")
        : "None"
    }</li>
    <li><strong>Images Without Alt Text:</strong> ${
      d.images_without_alt && d.images_without_alt.length > 0
        ? d.images_without_alt.length
        : "None"
    }</li>
  `;
      d3.select("#tooltip-scorecard-list").html(tooltipContent);

      d3.select(this).style("cursor", "pointer");
      labels.filter((l) => l === d).attr("display", null);

      node.classed("dimmed", true);
      link.classed("dimmed", true);
      node
        .filter(
          (n) =>
            n === d ||
            links.some(
              (l) =>
                ((l.source.id || l.source) === d.id &&
                  (l.target.id || l.target) === n.id) ||
                ((l.target.id || l.target) === d.id &&
                  (l.source.id || l.source) === n.id)
            )
        )
        .classed("dimmed", false)
        .classed("highlight", true);
      link
        .filter(
          (l) =>
            (l.source.id || l.source) === d.id ||
            (l.target.id || l.target) === d.id
        )
        .classed("dimmed", false)
        .classed("highlight", true);

      if (isGreen(d)) {
        node.each(function (n) {
          if (n !== d && isGreen(n))
            d3.select(this).style("opacity", GREEN_FADE_OPACITY);
        });
      }

      showArrowheadsForNeighbors(d.id);
    }

    function mouseout(event, d) {
      d3.select(this).style("cursor", "auto");
      labels.filter((l) => l === d).attr("display", "none");

      node
        .filter((n) => n !== currentlySelectedNode)
        .classed("dimmed", false)
        .classed("highlight", false);
      link
        .filter(
          (l) =>
            (l.source.id || l.source) !== currentlySelectedNode?.id &&
            (l.target.id || l.target) !== currentlySelectedNode?.id
        )
        .classed("dimmed", false)
        .classed("highlight", false);

      node.filter((n) => isGreen(n)).style("opacity", null);

      restoreAllArrowheads();
    }

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    function neighborsOf(id) {
      const set = new Set([id]);
      links.forEach((l) => {
        const s = idOf(l.source);
        const t = idOf(l.target);
        if (s === id) set.add(t);
        if (t === id) set.add(s);
      });
      return set;
    }

    function highlightNeighborhood(id) {
      const keep = neighborsOf(id);
      node.classed("dimmed", (d) => !keep.has(d.id));
      link.classed(
        "dimmed",
        (l) => !(keep.has(idOf(l.source)) && keep.has(idOf(l.target)))
      );
      node.classed("highlight", (d) => keep.has(d.id));
      link.classed(
        "highlight",
        (l) => keep.has(idOf(l.source)) && keep.has(idOf(l.target))
      );
    }

    function clearHighlight() {
      node.classed("dimmed", false).classed("highlight", false);
      link.classed("dimmed", false).classed("highlight", false);
      restoreAllArrowheads();
    }

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") clearHighlight();
    });
  })
  .catch(function (error) {
    console.error("Error loading or processing links.json:", error);
    d3.select("body")
      .append("p")
      .text(
        "Could not load or process crawl data. Check the console for errors."
      );
  });

function calculateScorecard(site_structure) {
  const pageValues = Object.values(site_structure);
  const totalPages = pageValues.length;

  if (totalPages === 0) {
    return {
      totalPages: 0,
      word_count: 0,
      readability_score: 0,
      sentiment: 0,
      image_count: 0,
      script_count: 0,
      stylesheet_count: 0,
      heading_count: 0,
      paragraph_count: 0,
      response_time: 0,
      internal_links: 0,
      external_links: 0,
      keyword_density: {},
      status_codes: {},
      viewport_meta_count: 0,
      semantic_elements: {
        main: 0,
        nav: 0,
        article: 0,
        section: 0,
        header: 0,
        footer: 0,
        aside: 0,
      },
      heading_issues: 0,
      unlabeled_inputs: 0,
      images_without_alt: 0,
      average_word_count: 0,
      average_readability_score: 0,
      average_sentiment: 0,
      average_response_time: 0,
    };
  }

  const aggregated = pageValues.reduce(
    (acc, page) => {
      if (typeof page !== "object" || page === null) return acc;

      acc.word_count += page.word_count || 0;
      acc.readability_score += page.readability_score || 0;
      acc.sentiment += page.sentiment || 0;
      acc.image_count += page.image_count || 0;
      acc.script_count += page.script_count || 0;
      acc.stylesheet_count += page.stylesheet_count || 0;
      acc.heading_count += page.heading_count || 0;
      acc.paragraph_count += page.paragraph_count || 0;
      acc.response_time += page.response_time || 0;

      acc.internal_links += Array.isArray(page.internal_links)
        ? page.internal_links.length
        : 0;
      acc.external_links += Array.isArray(page.external_links)
        ? page.external_links.length
        : 0;

      if (page.keyword_density && typeof page.keyword_density === "object") {
        for (const [keyword, density] of Object.entries(page.keyword_density)) {
          acc.keyword_density[keyword] =
            (acc.keyword_density[keyword] || 0) + density;
        }
      }

      if (page.status_code) {
        acc.status_codes[page.status_code] =
          (acc.status_codes[page.status_code] || 0) + 1;
      }

      acc.viewport_meta_count += page.has_viewport_meta ? 1 : 0;

      if (
        page.semantic_elements &&
        typeof page.semantic_elements === "object"
      ) {
        for (const [tag, present] of Object.entries(page.semantic_elements)) {
          if (present) acc.semantic_elements[tag]++;
        }
      }
      acc.heading_issues += Array.isArray(page.heading_issues)
        ? page.heading_issues.length
        : 0;
      acc.unlabeled_inputs += Array.isArray(page.unlabeled_inputs)
        ? page.unlabeled_inputs.length
        : 0;
      acc.images_without_alt += Array.isArray(page.images_without_alt)
        ? page.images_without_alt.length
        : 0;

      return acc;
    },
    {
      word_count: 0,
      readability_score: 0,
      sentiment: 0,
      image_count: 0,
      script_count: 0,
      stylesheet_count: 0,
      heading_count: 0,
      paragraph_count: 0,
      response_time: 0,
      internal_links: 0,
      external_links: 0,
      keyword_density: {},
      status_codes: {},
      viewport_meta_count: 0,
      semantic_elements: {
        main: 0,
        nav: 0,
        article: 0,
        section: 0,
        header: 0,
        footer: 0,
        aside: 0,
      },
      heading_issues: 0,
      unlabeled_inputs: 0,
      images_without_alt: 0,
    }
  );

  aggregated.average_word_count =
    totalPages > 0 ? aggregated.word_count / totalPages : 0;
  aggregated.average_readability_score =
    totalPages > 0 ? aggregated.readability_score / totalPages : 0;
  aggregated.average_sentiment =
    totalPages > 0 ? aggregated.sentiment / totalPages : 0;
  aggregated.average_response_time =
    totalPages > 0 ? aggregated.response_time / totalPages : 0;

  return {
    totalPages,
    ...aggregated,
  };
}

function displayScorecard(scorecard) {
  const list = d3.select("#scorecard-list").html("");
  list
    .append("li")
    .html(`<strong>Total Pages:</strong> ${scorecard.totalPages}`);
  list
    .append("li")
    .html(
      `<strong>Average Word Count:</strong> ${scorecard.average_word_count.toFixed(
        2
      )}`
    );
  list
    .append("li")
    .html(
      `<strong>Average Readability Score:</strong> ${scorecard.average_readability_score.toFixed(
        2
      )}`
    );
  list
    .append("li")
    .html(
      `<strong>Average Sentiment:</strong> ${scorecard.average_sentiment.toFixed(
        2
      )}`
    );
  list
    .append("li")
    .html(
      `<strong>Average Response Time:</strong> ${scorecard.average_response_time.toFixed(
        2
      )} seconds`
    );
  list
    .append("li")
    .html(`<strong>Total Images:</strong> ${scorecard.image_count}`);
  list
    .append("li")
    .html(`<strong>Total Scripts:</strong> ${scorecard.script_count}`);
  list
    .append("li")
    .html(`<strong>Total Stylesheets:</strong> ${scorecard.stylesheet_count}`);
  list
    .append("li")
    .html(`<strong>Total Headings:</strong> ${scorecard.heading_count}`);
  list
    .append("li")
    .html(`<strong>Total Paragraphs:</strong> ${scorecard.paragraph_count}`);
  list
    .append("li")
    .html(
      `<strong>Pages with Viewport Meta:</strong> ${scorecard.viewport_meta_count}`
    );
  list
    .append("li")
    .html(`<strong>Total Internal Links:</strong> ${scorecard.internal_links}`);
  list
    .append("li")
    .html(`<strong>Total External Links:</strong> ${scorecard.external_links}`);
  list
    .append("li")
    .html(
      `<strong>Heading Issues Detected:</strong> ${scorecard.heading_issues}`
    );
  list
    .append("li")
    .html(`<strong>Unlabeled Inputs:</strong> ${scorecard.unlabeled_inputs}`);
  list
    .append("li")
    .html(
      `<strong>Images Without Alt Text:</strong> ${scorecard.images_without_alt}`
    );

  const semanticUsed = Object.entries(scorecard.semantic_elements)
    .map(([tag, count]) => `${tag}: ${count}`)
    .join("<br/>");
  list
    .append("li")
    .html(`<strong>Semantic Element Usage:</strong><br/>${semanticUsed}`);

  const keywordList = Object.entries(scorecard.keyword_density)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(
      ([keyword, density]) =>
        `${keyword}: (Avg density ${(density / scorecard.totalPages).toFixed(
          4
        )})`
    )
    .join("<br/>");
  list
    .append("li")
    .html(
      `<strong>Top Keyword Density (Average):</strong><br/>${
        keywordList || "N/A"
      }`
    );

  const statusList = Object.entries(scorecard.status_codes)
    .map(([code, count]) => `${code}: ${count}`)
    .join("<br/>");
  list
    .append("li")
    .html(`<strong>Status Codes:</strong><br/>${statusList || "N/A"}`);
}

d3.json("links.json")
  .then((loaded_site_structure) => {
    if (
      loaded_site_structure &&
      Object.keys(loaded_site_structure).length > 0
    ) {
      const scorecard = calculateScorecard(loaded_site_structure);
      displayScorecard(scorecard);
    } else {
      console.warn("No data for scorecard in the second d3.json call.");
      const list = d3.select("#scorecard-list").html("");
      list.append("li").text("No scorecard data loaded.");
    }
  })
  .catch(function (error) {
    console.error("Error loading links.json for scorecard:", error);
    const list = d3.select("#scorecard-list").html("");
    list
      .append("li")
      .html(`<strong>Error loading scorecard data:</strong> ${error.message}`);
  });

d3.json("links.json")
  .then((loaded_site_structure) => {
    if (
      loaded_site_structure &&
      Object.keys(loaded_site_structure).length > 0
    ) {
      const scorecard = calculateScorecard(loaded_site_structure);
      displayScorecard(scorecard);
    } else {
      console.warn("No data for scorecard.");
    }
  })
  .catch(function (error) {
    console.error("Error loading links.json for scorecard:", error);
  });

document.addEventListener("DOMContentLoaded", () => {
  const analyzeButton = document.getElementById("analyze-node-button");
  const analysisOutput = document.getElementById("claude-analysis-output");

  if (analyzeButton && analysisOutput) {
    analyzeButton.addEventListener("click", () => {
      if (!currentlySelectedNode || !currentlySelectedNode.id) {
        analysisOutput.textContent =
          "Please hover over a node to select it before running analysis.";
        return;
      }

      analysisOutput.textContent = "Running analysis...";

      fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: currentlySelectedNode.id }),
      })
        .then(async (response) => {
          const responseText = await response.text();
          if (!response.ok) {
            throw new Error(`HTTP error ${response.status}: ${responseText}`);
          }
          try {
            return JSON.parse(responseText);
          } catch (e) {
            throw new Error("Invalid JSON response: " + responseText);
          }
        })
        .then((data) => {
          if (data.analysis) {
            analysisOutput.textContent = data.analysis;
          } else {
            analysisOutput.textContent = `Error: ${
              data.error || "Unexpected response format."
            }`;
          }
        })
        .catch((err) => {
          analysisOutput.textContent = `Request failed: ${err.message}`;
        });
    });
  } else {
    if (!analyzeButton) console.error("Analyze button not found.");
    if (!analysisOutput)
      console.error("Claude analysis output element not found.");
  }
});
