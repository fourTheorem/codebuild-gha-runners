# GitHub Actions Runners with CodeBuild ⚡️ 👷‍♀️

Created at [fourTheorem](https://fourtheorem.com) 🤝 by the [AWS Bites](https://awsbites.com) 🎙️ team

---

This project demonstrates how to run self-hosted GitHub Actions (GHA) Runners using AWS CodeBuild for a GitHub Organization.

It includes two AWS CDK stacks:

1. **CodeConnection Stack**: Sets up a CodeConnection to connect AWS services like CodeBuild to GitHub with organization access.
2. **GHA Runners Stack**: Deploys CodeBuild projects capable of acting as GitHub Actions Runners, triggered by GitHub Workflow Jobs.

Additionally, it includes a Node.js script ([`submit-runs.mjs`](./submitter/submit-runs.mjs)) that triggers multiple workflow executions and monitors their completion, calculating statistics on their execution times.
The included workflows ([manual.yml](./.github/workflows/manual.yml) and [manual-lambda.yml](./.github/workflows/manual-lambda.yml)) have a simple job that sleep for 60 seconds. The script's output can tell us how much extra time is spent orchestrating and provisioning the runners.

## Overview

Running GitHub Actions in AWS CodeBuild provides some benefits:
- **Simplicity**: There is very little infrastructure to manage.
- **Scalability**: AWS CodeBuild automatically scales with the workload.
- **Cost Efficiency**: While CodeBuild isn't as cheap as EC2-based runners, it has a pay-as-you-go model, which is ideal for large workloads or workflows that require high concurrency.
- **Customization**: CodeBuild environments can be highly customized to suit the requirements of your GitHub Actions workflows, including the ability to run Lambda-compatible containers as well as GPU support.

This project sets up the necessary infrastructure using AWS CDK to deploy CodeBuild projects that act as self-hosted runners for GitHub Actions.

## What's included

The infrastructure for self-hosted GitHub Actions runners using CodeBuild is split into two stacks:

1. [**CodeConnection Stack**](./lib/connconnection-stack.ts): Deploys a CodeConnection resource that allows CodeBuild to interact with GitHub repositories. This stack also creates a managed IAM policy that ensures the CodeBuild projects have sufficient permissions to use the connection. Deploying the policy separately from the CodeBuild projects avoids IAM eventual consistency issues.

2. [**GHA Runners Stack**](./lib/gha-runners-stack.ts): Deploys two sample CodeBuild projects that serve as GitHub Actions Runners; a standard Linux project and a Lambda-based project.  These projects are configured to trigger builds when a GitHub workflow job is queued. By default, a _small_ sized CodeBuild project and a _4GB_ lambda-based project are configured.

## Prerequisites

- **GitHub Token**: A GitHub personal access token is required to use the `submit-runs.mjs` script.

## Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/fourTheorem/codebuild-gha-runners.git
cd codebuild-gha-runners
```

### Step 2: Install Dependencies

Install the required dependencies:

```bash
npm install
```

### Step 3: Configure GitHub Organisation

Add your GitHub organization to the CDK context. You can do this by modifying `cdk.json`:

```json
{
  "context": {
    "githuborg": "your-github-organization"
  }
}
```

### Step 4: Deploy the Stacks

#### 4.1: Deploy the CodeConnection Stack

This stack will create a CodeConnection and an IAM managed policy required for accessing the connection in CodeBuild.

```bash
cdk deploy CodeConnectionStack
```

After deploying this stack, you will need to finalize the connection in the AWS Console by manually authorizing the connection to access your GitHub repository ([docs here](https://docs.aws.amazon.com/dtconsole/latest/userguide/connections-update.html)).

#### 4.2: Deploy the GHA Runners Stack

Once the connection is authorized, deploy the GHA Runners Stack to set up CodeBuild projects that act as GitHub Actions Runners.

```bash
cdk deploy GhaRunnersStack
```

This stack will create CodeBuild projects that can be triggered by GitHub workflow jobs, using the CodeConnection created earlier.

### 4.3 Configure your GitHub Actions

This repository itself has workflows that use the runners we have configured. You can use this repository as a test, but first you should fork it into your own organization. Alternatively, you can create or modify your own GitHub workflows.

The important line to add to your workflows is:

```yaml
jobs:
  build:
    runs-on:
      - codebuild-gha-runners-${{ github.run_id }}-${{ github.run_attempt }}
```

If you wish to use the Lambda runners instead, use:

```yaml
jobs:
  build:
    runs-on:
      - codebuild-gha-runners-lambda-${{ github.run_id }}-${{ github.run_attempt }}
```

See the [workflows](./.github/workflows) directory for our examples.


## Node.js Script for Submitting Workflow Runs

### Usage

The `submit-runs.mjs` script is used to trigger multiple GitHub workflow executions and monitor their completion. It provides statistics on the execution times for the workflows, such as min, max, mean, median, and P90.

### Prerequisites

- **GitHub Token**: Export your GitHub token as an environment variable before running the script:
  ```bash
  export GITHUB_TOKEN=your-github-token
  ```

### Running the Script

To run the script, use the following command:

```bash
PATH_TO_THIS_REPO/submitter/submit-runs.mjs --workflow <workflow-file> --concurrent <number-of-runs> [--ref <branch>]
```

#### Example:

```bash
submitter/submit-runs.mjs --workflow manual-lambda.yml --concurrent 5
```

This command will trigger 5 concurrent runs of the `manual-lambda.yml` workflow on the `main` branch.

### Output

The script will display statistics like:
- **Min execution time**
- **Max execution time**
- **Median execution time**
- **Mean execution time**
- **P90 execution time**
- **Overall start and end times**
- **Total duration**

Here is a sample of the output

```
Min execution time: 100 seconds
Max execution time: 111 seconds
Median execution time: 107 seconds
Mean execution time: 106.15 seconds
P90 execution time: 109 seconds
Overall start time: Wed Oct 02 2024 20:53:30 GMT+0100 (Irish Standard Time)
Overall end time: Wed Oct 02 2024 20:55:29 GMT+0100 (Irish Standard Time)
Total duration: 119 seconds
```

## Other Projects 🤩

While creating this, we came across and were inspired by these great resources. Check them out - they might just suit your needs better! 🙂

1. [philips-labs/terraform-aws-github-runner](https://github.com/philips-labs/terraform-aws-github-runner)
2. [garysassano/cdktf-aws-codebuild-github-runners-organization](https://github.com/garysassano/cdktf-aws-codebuild-github-runners-organization)
3. [machulav/ec2-github-runner](https://github.com/machulav/ec2-github-runner)
4. [Cloudonaut - Self-Hosted GitHub Runners on AWS](https://cloudonaut.io/self-hosted-github-runners-on-aws/)
5. [AWS: Best Practices for Working with Self-Hosted GitHub Action Runners at Scale on AWS](https://aws.amazon.com/blogs/devops/best-practices-working-with-self-hosted-github-action-runners-at-scale-on-aws/)
6. [AWS CodeBuild Managed Self-Hosted GitHub Action Runners](https://aws.amazon.com/blogs/devops/aws-codebuild-managed-self-hosted-github-action-runners/)

Also feel free to check out these alternatives solutions for runners!

- [HyperEnv - Self-hosted GitHub runners on AWS](https://hyperenv.com/)
- [RunsOn - Self-hosted runners on AWS](https://runs-on.com/)
- [Blacksmith - Managed GitHub runners](https://www.blacksmith.sh/)

## License

This project is licensed under the Apache License.
