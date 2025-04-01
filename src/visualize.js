// ~/akash-checker/src/visualize.js
const Chart = require('chart.js/auto');
const ChartImage = require('chartjs-to-image');

class Visualizer {
  constructor(metrics) {
    this.metrics = metrics;
    this.nodeIds = Object.keys(metrics);
  }

  async createBarChart(dataKey, title, ylabel, filename, color) {
    const chart = new ChartImage();
    chart.setConfig({
      type: 'bar',
      data: {
        labels: this.nodeIds.map(id => id.slice(0, 8) + '...'),
        datasets: [{
          label: ylabel,
          data: this.nodeIds.map(id => this.metrics[id][dataKey]),
          backgroundColor: color
        }]
      },
      options: {
        scales: { y: { beginAtZero: true, title: { display: true, text: ylabel } } },
        plugins: { title: { display: true, text: title } }
      }
    });
    await chart.toFile(filename);
  }

  async generateVisualizations() {
    await this.createBarChart('retrievabilityScore', 'Node Retrievability Scores', 'Retrievability (%)', 'retrievability.png', 'rgba(54, 162, 235, 0.8)');
    await this.createBarChart('avgLatency', 'Node Average Latency', 'Latency (ms)', 'latency.png', 'rgba(75, 192, 192, 0.8)');
    await this.createBarChart('availabilityScore', 'Node Availability Scores', 'Availability (%)', 'availability.png', 'rgba(255, 206, 86, 0.8)');
    await this.createBarChart('avgBandwidth', 'Node Average Bandwidth', 'Bandwidth (MB/s)', 'bandwidth.png', 'rgba(153, 102, 255, 0.8)');
    await this.createBarChart('uptimeScore', 'Node Uptime Scores', 'Uptime (%)', 'uptime.png', 'rgba(255, 99, 132, 0.8)');
    await this.createBarChart('computeAccuracyScore', 'Node Compute Accuracy Scores', 'Compute Accuracy (%)', 'compute_accuracy.png', 'rgba(255, 159, 64, 0.8)');
  }
}

module.exports = Visualizer;