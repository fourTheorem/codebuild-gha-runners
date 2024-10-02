#!/usr/bin/env node
import { Octokit } from '@octokit/rest'
import { Command } from 'commander'
import simpleGit from 'simple-git'
const program = new Command()

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN })

const calculateStatistics = (times) => {
  times.sort((a, b) => a - b)
  const min = Math.min(...times)
  const max = Math.max(...times)
  const mean = times.reduce((a, b) => a + b, 0) / times.length

  const median =
    times.length % 2 === 0
      ? (times[times.length / 2 - 1] + times[times.length / 2]) / 2
      : times[Math.floor(times.length / 2)]

  const p90 = times[Math.floor(times.length * 0.9)]

  return { min, max, mean, median, p90 }
}

// Function to trigger a workflow execution
const triggerWorkflow = async (owner, repo, workflowFileName, ref) => {
  const response = await octokit.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: workflowFileName,
    ref
  })
  return response
}

const getGitHubRepoInfo = async () => {
  const git = simpleGit()
  const remotes = await git.getRemotes(true)
  const originRemote = remotes.find((remote) => remote.name === 'origin')

  if (!originRemote) {
    throw new Error('No origin remote found. Make sure this is a Git repository with a remote named "origin".')
  }

  // Parse the URL, assuming it's in the format: git@github.com:owner/repo.git or https://github.com/owner/repo.git
  const match = originRemote.refs.fetch.match(/github\.com[:\/](.+?)\/(.+?)(\.git)?$/)

  if (!match) {
    throw new Error('Could not parse GitHub repository information from the origin URL.')
  }

  return {
    owner: match[1],
    repo: match[2]
  }
}

const getRecentCompletedWorkflowRuns = async (owner, repo, ref, workflowFileName, afterTime) => {
  const { data } = await octokit.actions.listWorkflowRunsForRepo({
    owner,
    repo,
    branch: ref,
    event: 'workflow_dispatch',
    // status: 'completed',
    per_page: 500,
    created: `>=${afterTime.toISOString()}`
  })

  return data.workflow_runs.filter((run) => run.path.endsWith(`/${workflowFileName}`))
}

const monitorWorkflowRuns = async (owner, repo, workflowFileName, concurrentExecutions, ref) => {
  const triggerTime = new Date()

  // Trigger multiple workflows
  for (let i = 0; i < concurrentExecutions; i++) {
    await triggerWorkflow(owner, repo, workflowFileName, ref)
    console.log(`Triggered workflow run #${i + 1}`)
  }

  // Monitor workflow runs until all are completed
  let completedRuns = []
  while (completedRuns.length < concurrentExecutions) {
    await new Promise((resolve) => setTimeout(resolve, 10000))
    console.log('Polling for completed workflow runs...')
    const runs = await getRecentCompletedWorkflowRuns(owner, repo, ref, workflowFileName, triggerTime)

    // Get only the completed runs
    completedRuns = runs.filter((run) => run.status === 'completed')
  }

  // Extract execution times
  const executionTimes = completedRuns.map((run) => {
    const start = new Date(run.created_at).getTime()
    const end = new Date(run.updated_at).getTime()
    return end - start
  })

  const stats = calculateStatistics(executionTimes)

  const minStartTime = Math.min(...completedRuns.map((run) => new Date(run.created_at).getTime()))
  const maxEndTime = Math.max(...completedRuns.map((run) => new Date(run.updated_at).getTime()))

  return {
    minExecutionTime: stats.min,
    maxExecutionTime: stats.max,
    medianExecutionTime: stats.median,
    meanExecutionTime: stats.mean,
    p90ExecutionTime: stats.p90,
    overallStartTime: new Date(minStartTime),
    overallEndTime: new Date(maxEndTime),
    totalDuration: (maxEndTime - minStartTime) / 1000,
    concurrentExecutionCount: concurrentExecutions
  }
}

const main = async () => {
  program
    .version('1.0.0')
    .requiredOption('-w, --workflow <filename>', 'Workflow file name')
    .requiredOption('-c, --concurrent <number>', 'Number of concurrent executions', Number.parseInt)
    .option('-r, --ref [ref]', 'Git reference to use for triggering workflows', 'main')

  program.parse()

  const options = program.opts()

  const { owner, repo } = await getGitHubRepoInfo()
  const result = await monitorWorkflowRuns(owner, repo, options.workflow, options.concurrent, options.ref)

  console.log(`Min execution time: ${result.minExecutionTime / 1000} seconds`)
  console.log(`Max execution time: ${result.maxExecutionTime / 1000} seconds`)
  console.log(`Median execution time: ${result.medianExecutionTime / 1000} seconds`)
  console.log(`Mean execution time: ${result.meanExecutionTime / 1000} seconds`)
  console.log(`P90 execution time: ${result.p90ExecutionTime / 1000} seconds`)
  console.log(`Overall start time: ${result.overallStartTime}`)
  console.log(`Overall end time: ${result.overallEndTime}`)
  console.log(`Total duration: ${result.totalDuration} seconds`)
}

main().catch((err) => console.error(err))
