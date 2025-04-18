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
      <li><strong>Title:</strong> ${d.title}</li>
      <li><strong>URL:</strong> <a href="${d.id}" target="_blank">${
      d.id
    }</a></li>
      <li><strong>Connections:</strong> ${connectedLinks}</li>
      <li><strong>Meta Description:</strong> ${d.meta_description}</li>
      <li><strong>Meta Keywords:</strong> ${d.meta_keywords}</li>
      <li><strong>H1 Tags:</strong> ${d.h1_tags.join(", ") || "None"}</li>
      <li><strong>Word Count:</strong> ${d.word_count}</li>
      <li><strong>Unigram Density:</strong><br/>${keywordDensityFormatted}</li>
      <li><strong>Readability Score:</strong> ${d.readability_score.toFixed(
        2
      )}</li>
      <li><strong>Sentiment:</strong> ${d.sentiment.toFixed(2)}</li>
      <li><strong>Image Count:</strong> ${d.image_count}</li>
      <li><strong>Script Count:</strong> ${d.script_count}</li>
      <li><strong>Stylesheet Count:</strong> ${d.stylesheet_count}</li>
      <li><strong>Has Viewport Meta:</strong> ${
        d.has_viewport_meta ? "Yes" : "No"
      }</li>
      <li><strong>Heading Count:</strong> ${d.heading_count}</li>
      <li><strong>Paragraph Count:</strong> ${d.paragraph_count}</li>
      <li><strong>Status Code:</strong> ${d.status_code}</li>
      <li><strong>Response Time:</strong> ${d.response_time.toFixed(
        2
      )} seconds</li>
      <li><strong>Number Of Internal Links:</strong> ${
        d.internal_links.length
      } links</li>
      <li><strong>Number Of External Links:</strong> ${
        d.external_links.length
      } links</li>
      <li><strong>Semantic Elements:</strong><br/>${Object.entries(
        d.semantic_elements
      )
        .map(([tag, present]) => `${tag}: ${present ? "✔️" : "❌"}`)
        .join("<br/>")}</li>
      <li><strong>Heading Structure Issues:</strong> ${
        d.heading_issues.length > 0
          ? d.heading_issues.map((pair) => `${pair[0]} → ${pair[1]}`).join(", ")
          : "None"
      }</li>
      <li><strong>Unlabeled Inputs:</strong> ${
        d.unlabeled_inputs.length > 0 ? d.unlabeled_inputs.join(", ") : "None"
      }</li>
      <li><strong>Images Without Alt Text:</strong> ${
        d.images_without_alt.length > 0 ? d.images_without_alt.length : "None"
      }</li>
    `;

    d3.select("#tooltip-scorecard-list").html(tooltipContent);

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
    d3.select("#tooltip-scorecard-list").html("");
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
      acc.script_count += page.script_count || 0;
      acc.stylesheet_count += page.stylesheet_count || 0;
      acc.heading_count += page.heading_count || 0;
      acc.paragraph_count += page.paragraph_count || 0;
      acc.response_time += page.response_time || 0;

      acc.internal_links += page.internal_links.length || 0;
      acc.external_links += page.external_links.length || 0;

      for (const [keyword, density] of Object.entries(page.keyword_density)) {
        acc.keyword_density[keyword] =
          (acc.keyword_density[keyword] || 0) + density;
      }

      acc.status_codes[page.status_code] =
        (acc.status_codes[page.status_code] || 0) + 1;

      acc.viewport_meta_count += page.has_viewport_meta ? 1 : 0;

      for (const [tag, present] of Object.entries(
        page.semantic_elements || {}
      )) {
        if (present) acc.semantic_elements[tag]++;
      }
      acc.heading_issues += (page.heading_issues || []).length;
      acc.unlabeled_inputs += (page.unlabeled_inputs || []).length;
      acc.images_without_alt += (page.images_without_alt || []).length;

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
    .join(", ");
  list
    .append("li")
    .html(`<strong>Semantic Element Usage:</strong> ${semanticUsed}`);

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
