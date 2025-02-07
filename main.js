d3.json("links.json").then(function (site_structure) {
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
      internal_links: data.internal_links || [],
      external_links: data.external_links || [],
    };
  }

  Object.keys(site_structure).forEach((source) => {
    if (!nodes.some((node) => node.id === source)) {
      nodes.push(getNodeData(source));
    }

    site_structure[source].internal_links.forEach((target) => {
      links.push({ source, target });
      if (!nodes.some((node) => node.id === target)) {
        nodes.push(getNodeData(target));
      }
    });
  });

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

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(430)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  const link = container
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .attr("class", "link");

  const node = container
    .append("g")
    .attr("class", "nodes")
    .selectAll("circle")
    .data(nodes)
    .enter()
    .append("circle")
    .attr("r", 10)
    .attr("fill", "magenta")
    .attr("stroke", "black")
    .attr("stroke-width", 2)
    .on("mouseover", mouseover)
    .on("mouseout", mouseout)
    .on("click", (event, d) => window.open(d.id, "_blank"))
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);
    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
  });

  function mouseover(event, d) {
    const connectedLinks = links.filter(
      (l) => l.source.id === d.id || l.target.id === d.id
    ).length;

    const keywordDensityFormatted =
      Object.entries(d.keyword_density)
        .filter(([keyword, density]) => density > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(
          ([keyword, density]) => `${keyword}: ${(density * 100).toFixed(2)}%`
        )
        .join("<br/>") || "";

    const tooltipContent = `
        <strong>Title:</strong> ${d.title}<br/>
        <strong>URL:</strong> <a href="${d.id}" target="_blank">${d.id}</a><br/>
        <strong>Connections:</strong> ${connectedLinks}<br/>
        <strong>Meta Description:</strong> ${d.meta_description}<br/>
        <strong>Meta Keywords:</strong> ${d.meta_keywords}<br/>
        <strong>H1 Tags:</strong> ${d.h1_tags.join(", ") || "None"}<br/>
        <strong>Word Count:</strong> ${d.word_count}<br/>
        <strong>Unigram Density:</strong><br/>${keywordDensityFormatted}<br/>
        <strong>Readability Score:</strong> ${d.readability_score.toFixed(
          2
        )}<br/>
        <strong>Sentiment:</strong> ${d.sentiment.toFixed(2)}<br/>
        <strong>Image Count:</strong> ${d.image_count}<br/>
        <strong>Status Code:</strong> ${d.status_code}<br/>
        <strong>Response Time:</strong> ${d.response_time.toFixed(
          2
        )} seconds<br/>
        <strong>Number Of Internal Links:</strong> ${
          d.internal_links.length
        } links<br/>
        <strong>Number Of External Links:</strong> ${
          d.external_links.length
        } links
    `;

    d3.select("#tooltip")
      .style("opacity", 1)
      .html(tooltipContent)
      .style("left", `${event.pageX + 15}px`)
      .style("top", `${event.pageY - 28}px`);

    d3.select(this).style("cursor", "pointer");

    node.classed("dimmed", true);
    link.classed("dimmed", true);

    node
      .filter(
        (n) =>
          n === d ||
          links.some(
            (l) =>
              (l.source.id === d.id && l.target.id === n.id) ||
              (l.target.id === d.id && l.source.id === n.id)
          )
      )
      .classed("dimmed", false)
      .classed("highlight", true);

    link
      .filter((l) => l.source.id === d.id || l.target.id === d.id)
      .classed("dimmed", false)
      .classed("highlight", true);
  }

  function mouseout() {
    d3.select("#tooltip").style("opacity", 0);
    node.classed("dimmed", false).classed("highlight", false);
    link.classed("dimmed", false).classed("highlight", false);
    d3.select(this).style("cursor", "auto");
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
});

function calculateScorecard(site_structure) {
  const totalPages = Object.keys(site_structure).length;

  const aggregated = Object.values(site_structure).reduce(
    (acc, page) => {
      acc.word_count += page.word_count || 0;
      acc.readability_score += page.readability_score || 0;
      acc.sentiment += page.sentiment || 0;
      acc.image_count += page.image_count || 0;
      acc.response_time += page.response_time || 0;

      acc.internal_links += page.internal_links.length || 0;
      acc.external_links += page.external_links.length || 0;

      for (const [keyword, density] of Object.entries(page.keyword_density)) {
        acc.keyword_density[keyword] =
          (acc.keyword_density[keyword] || 0) + density;
      }

      acc.status_codes[page.status_code] =
        (acc.status_codes[page.status_code] || 0) + 1;

      return acc;
    },
    {
      word_count: 0,
      readability_score: 0,
      sentiment: 0,
      image_count: 0,
      response_time: 0,
      internal_links: 0,
      external_links: 0,
      keyword_density: {},
      status_codes: {},
    }
  );

  aggregated.average_word_count = aggregated.word_count / totalPages;
  aggregated.average_readability_score =
    aggregated.readability_score / totalPages;
  aggregated.average_sentiment = aggregated.sentiment / totalPages;
  aggregated.average_response_time = aggregated.response_time / totalPages;

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
    .html(`<strong>Total Internal Links:</strong> ${scorecard.internal_links}`);
  list
    .append("li")
    .html(`<strong>Total External Links:</strong> ${scorecard.external_links}`);

  const keywordList = Object.entries(scorecard.keyword_density)
    .sort(([, densityA], [, densityB]) => densityB - densityA)
    .slice(0, 23)
    .map(
      ([keyword, density]) =>
        `${keyword}: ${(density / scorecard.totalPages).toFixed(4)}`
    )
    .join(", ");
  list.append("li").html(`<strong>Keyword Density:</strong> ${keywordList}`);

  const statusList = Object.entries(scorecard.status_codes)
    .map(([code, count]) => `${code}: ${count}`)
    .join(", ");
  list.append("li").html(`<strong>Status Codes:</strong> ${statusList}`);
}

d3.json("links.json").then((site_structure) => {
  const scorecard = calculateScorecard(site_structure);
  displayScorecard(scorecard);
});
