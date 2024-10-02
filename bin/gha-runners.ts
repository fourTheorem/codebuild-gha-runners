#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from 'aws-cdk-lib'
import { CodeConnectionStack } from '../lib/connconnection-stack'
import { GhaRunnersStack } from '../lib/gha-runners-stack'

const app = new cdk.App()
const connectionStack = new CodeConnectionStack(app, 'ConnectionStack', {})
const ghaRunnersStack = new GhaRunnersStack(app, 'GhaRunnersStack', {})
ghaRunnersStack.addDependency(connectionStack, 'Connection must be created first and be approved in AWS Console')
