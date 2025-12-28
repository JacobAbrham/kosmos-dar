/**
 * AWS MCP Server - Amazon Web Services integration for KOSMOS
 * Provides access to core AWS services
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import { S3Client, ListBucketsCommand, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand, DescribeSecurityGroupsCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, ListFunctionsCommand, InvokeCommand, GetFunctionCommand } from "@aws-sdk/client-lambda";
import { DynamoDBClient, ListTablesCommand, ScanCommand, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, ListQueuesCommand, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, ListTopicsCommand, PublishCommand, ListSubscriptionsCommand } from "@aws-sdk/client-sns";
import { IAMClient, ListUsersCommand, ListRolesCommand, GetUserCommand } from "@aws-sdk/client-iam";
import { CloudWatchClient, GetMetricDataCommand, ListMetricsCommand, PutMetricAlarmCommand } from "@aws-sdk/client-cloudwatch";
import { ECSClient, ListClustersCommand, ListServicesCommand, DescribeServicesCommand, UpdateServiceCommand } from "@aws-sdk/client-ecs";
import { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } from "@aws-sdk/client-rds";

const config = {
  region: process.env.AWS_REGION || "us-east-1",
};

const s3 = new S3Client({ region: config.region });
const ec2 = new EC2Client({ region: config.region });
const lambda = new LambdaClient({ region: config.region });
const dynamodb = new DynamoDBClient({ region: config.region });
const sqs = new SQSClient({ region: config.region });
const sns = new SNSClient({ region: config.region });
const iam = new IAMClient({ region: config.region });
const cloudwatch = new CloudWatchClient({ region: config.region });
const ecs = new ECSClient({ region: config.region });
const rds = new RDSClient({ region: config.region });

const TOOLS: Tool[] = [
  // S3
  { name: "s3_list_buckets", description: "List all S3 buckets.", inputSchema: { type: "object", properties: {} } },
  { name: "s3_list_objects", description: "List objects in a bucket.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, prefix: { type: "string" }, maxKeys: { type: "number" } }, required: ["bucket"] } },
  { name: "s3_get_object", description: "Get an object from S3.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, key: { type: "string" } }, required: ["bucket", "key"] } },
  { name: "s3_put_object", description: "Put an object to S3.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, key: { type: "string" }, body: { type: "string" }, contentType: { type: "string" } }, required: ["bucket", "key", "body"] } },
  { name: "s3_delete_object", description: "Delete an object from S3.", inputSchema: { type: "object", properties: { bucket: { type: "string" }, key: { type: "string" } }, required: ["bucket", "key"] } },
  // EC2
  { name: "ec2_describe_instances", description: "Describe EC2 instances.", inputSchema: { type: "object", properties: { instanceIds: { type: "array", items: { type: "string" } }, filters: { type: "array" } } } },
  { name: "ec2_start_instances", description: "Start EC2 instances.", inputSchema: { type: "object", properties: { instanceIds: { type: "array", items: { type: "string" } } }, required: ["instanceIds"] } },
  { name: "ec2_stop_instances", description: "Stop EC2 instances.", inputSchema: { type: "object", properties: { instanceIds: { type: "array", items: { type: "string" } } }, required: ["instanceIds"] } },
  { name: "ec2_describe_security_groups", description: "Describe security groups.", inputSchema: { type: "object", properties: { groupIds: { type: "array", items: { type: "string" } } } } },
  // Lambda
  { name: "lambda_list_functions", description: "List Lambda functions.", inputSchema: { type: "object", properties: { maxItems: { type: "number" } } } },
  { name: "lambda_invoke", description: "Invoke a Lambda function.", inputSchema: { type: "object", properties: { functionName: { type: "string" }, payload: { type: "object" }, invocationType: { type: "string", enum: ["RequestResponse", "Event", "DryRun"] } }, required: ["functionName"] } },
  { name: "lambda_get_function", description: "Get Lambda function details.", inputSchema: { type: "object", properties: { functionName: { type: "string" } }, required: ["functionName"] } },
  // DynamoDB
  { name: "dynamodb_list_tables", description: "List DynamoDB tables.", inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
  { name: "dynamodb_scan", description: "Scan a DynamoDB table.", inputSchema: { type: "object", properties: { tableName: { type: "string" }, limit: { type: "number" }, filterExpression: { type: "string" } }, required: ["tableName"] } },
  { name: "dynamodb_get_item", description: "Get an item from DynamoDB.", inputSchema: { type: "object", properties: { tableName: { type: "string" }, key: { type: "object" } }, required: ["tableName", "key"] } },
  { name: "dynamodb_put_item", description: "Put an item to DynamoDB.", inputSchema: { type: "object", properties: { tableName: { type: "string" }, item: { type: "object" } }, required: ["tableName", "item"] } },
  // SQS
  { name: "sqs_list_queues", description: "List SQS queues.", inputSchema: { type: "object", properties: { queueNamePrefix: { type: "string" } } } },
  { name: "sqs_send_message", description: "Send a message to SQS.", inputSchema: { type: "object", properties: { queueUrl: { type: "string" }, messageBody: { type: "string" }, delaySeconds: { type: "number" } }, required: ["queueUrl", "messageBody"] } },
  { name: "sqs_receive_messages", description: "Receive messages from SQS.", inputSchema: { type: "object", properties: { queueUrl: { type: "string" }, maxMessages: { type: "number" }, waitTimeSeconds: { type: "number" } }, required: ["queueUrl"] } },
  { name: "sqs_delete_message", description: "Delete a message from SQS.", inputSchema: { type: "object", properties: { queueUrl: { type: "string" }, receiptHandle: { type: "string" } }, required: ["queueUrl", "receiptHandle"] } },
  // SNS
  { name: "sns_list_topics", description: "List SNS topics.", inputSchema: { type: "object", properties: {} } },
  { name: "sns_publish", description: "Publish a message to SNS.", inputSchema: { type: "object", properties: { topicArn: { type: "string" }, message: { type: "string" }, subject: { type: "string" } }, required: ["topicArn", "message"] } },
  { name: "sns_list_subscriptions", description: "List SNS subscriptions.", inputSchema: { type: "object", properties: { topicArn: { type: "string" } } } },
  // IAM
  { name: "iam_list_users", description: "List IAM users.", inputSchema: { type: "object", properties: { maxItems: { type: "number" } } } },
  { name: "iam_list_roles", description: "List IAM roles.", inputSchema: { type: "object", properties: { maxItems: { type: "number" } } } },
  { name: "iam_get_user", description: "Get IAM user details.", inputSchema: { type: "object", properties: { userName: { type: "string" } }, required: ["userName"] } },
  // CloudWatch
  { name: "cloudwatch_list_metrics", description: "List CloudWatch metrics.", inputSchema: { type: "object", properties: { namespace: { type: "string" }, metricName: { type: "string" } } } },
  { name: "cloudwatch_get_metric_data", description: "Get CloudWatch metric data.", inputSchema: { type: "object", properties: { metricQueries: { type: "array" }, startTime: { type: "string" }, endTime: { type: "string" } }, required: ["metricQueries", "startTime", "endTime"] } },
  // ECS
  { name: "ecs_list_clusters", description: "List ECS clusters.", inputSchema: { type: "object", properties: {} } },
  { name: "ecs_list_services", description: "List ECS services.", inputSchema: { type: "object", properties: { cluster: { type: "string" } }, required: ["cluster"] } },
  { name: "ecs_describe_services", description: "Describe ECS services.", inputSchema: { type: "object", properties: { cluster: { type: "string" }, services: { type: "array", items: { type: "string" } } }, required: ["cluster", "services"] } },
  { name: "ecs_update_service", description: "Update ECS service.", inputSchema: { type: "object", properties: { cluster: { type: "string" }, service: { type: "string" }, desiredCount: { type: "number" } }, required: ["cluster", "service"] } },
  // RDS
  { name: "rds_describe_instances", description: "Describe RDS instances.", inputSchema: { type: "object", properties: { dbInstanceId: { type: "string" } } } },
  { name: "rds_describe_clusters", description: "Describe RDS clusters.", inputSchema: { type: "object", properties: { dbClusterId: { type: "string" } } } },
];

// S3 Functions
async function s3ListBuckets(): Promise<any> {
  const result = await s3.send(new ListBucketsCommand({}));
  return { buckets: result.Buckets?.map(b => ({ name: b.Name, creationDate: b.CreationDate })) };
}

async function s3ListObjects(params: { bucket: string; prefix?: string; maxKeys?: number }): Promise<any> {
  const result = await s3.send(new ListObjectsV2Command({ Bucket: params.bucket, Prefix: params.prefix, MaxKeys: params.maxKeys }));
  return { objects: result.Contents?.map(o => ({ key: o.Key, size: o.Size, lastModified: o.LastModified })), isTruncated: result.IsTruncated };
}

async function s3GetObject(params: { bucket: string; key: string }): Promise<any> {
  const result = await s3.send(new GetObjectCommand({ Bucket: params.bucket, Key: params.key }));
  const body = await result.Body?.transformToString();
  return { body, contentType: result.ContentType, contentLength: result.ContentLength, lastModified: result.LastModified };
}

async function s3PutObject(params: { bucket: string; key: string; body: string; contentType?: string }): Promise<any> {
  await s3.send(new PutObjectCommand({ Bucket: params.bucket, Key: params.key, Body: params.body, ContentType: params.contentType }));
  return { success: true, bucket: params.bucket, key: params.key };
}

async function s3DeleteObject(params: { bucket: string; key: string }): Promise<any> {
  await s3.send(new DeleteObjectCommand({ Bucket: params.bucket, Key: params.key }));
  return { deleted: true, bucket: params.bucket, key: params.key };
}

// EC2 Functions
async function ec2DescribeInstances(params: { instanceIds?: string[]; filters?: any[] }): Promise<any> {
  const result = await ec2.send(new DescribeInstancesCommand({ InstanceIds: params.instanceIds, Filters: params.filters }));
  const instances = result.Reservations?.flatMap(r => r.Instances || []).map(i => ({
    instanceId: i.InstanceId, state: i.State?.Name, type: i.InstanceType, publicIp: i.PublicIpAddress, privateIp: i.PrivateIpAddress,
  }));
  return { instances };
}

async function ec2StartInstances(params: { instanceIds: string[] }): Promise<any> {
  const result = await ec2.send(new StartInstancesCommand({ InstanceIds: params.instanceIds }));
  return { startingInstances: result.StartingInstances };
}

async function ec2StopInstances(params: { instanceIds: string[] }): Promise<any> {
  const result = await ec2.send(new StopInstancesCommand({ InstanceIds: params.instanceIds }));
  return { stoppingInstances: result.StoppingInstances };
}

async function ec2DescribeSecurityGroups(params: { groupIds?: string[] }): Promise<any> {
  const result = await ec2.send(new DescribeSecurityGroupsCommand({ GroupIds: params.groupIds }));
  return { securityGroups: result.SecurityGroups?.map(sg => ({ groupId: sg.GroupId, groupName: sg.GroupName, description: sg.Description })) };
}

// Lambda Functions
async function lambdaListFunctions(params: { maxItems?: number }): Promise<any> {
  const result = await lambda.send(new ListFunctionsCommand({ MaxItems: params.maxItems }));
  return { functions: result.Functions?.map(f => ({ name: f.FunctionName, runtime: f.Runtime, memory: f.MemorySize, timeout: f.Timeout })) };
}

async function lambdaInvoke(params: { functionName: string; payload?: any; invocationType?: string }): Promise<any> {
  const result = await lambda.send(new InvokeCommand({
    FunctionName: params.functionName,
    Payload: params.payload ? new TextEncoder().encode(JSON.stringify(params.payload)) : undefined,
    InvocationType: (params.invocationType || "RequestResponse") as any,
  }));
  const payload = result.Payload ? new TextDecoder().decode(result.Payload) : null;
  return { statusCode: result.StatusCode, payload: payload ? JSON.parse(payload) : null, functionError: result.FunctionError };
}

async function lambdaGetFunction(params: { functionName: string }): Promise<any> {
  const result = await lambda.send(new GetFunctionCommand({ FunctionName: params.functionName }));
  return { configuration: result.Configuration, code: { location: result.Code?.Location } };
}

// DynamoDB Functions
async function dynamodbListTables(params: { limit?: number }): Promise<any> {
  const result = await dynamodb.send(new ListTablesCommand({ Limit: params.limit }));
  return { tables: result.TableNames };
}

async function dynamodbScan(params: { tableName: string; limit?: number; filterExpression?: string }): Promise<any> {
  const result = await dynamodb.send(new ScanCommand({ TableName: params.tableName, Limit: params.limit, FilterExpression: params.filterExpression }));
  return { items: result.Items, count: result.Count, scannedCount: result.ScannedCount };
}

async function dynamodbGetItem(params: { tableName: string; key: any }): Promise<any> {
  const result = await dynamodb.send(new GetItemCommand({ TableName: params.tableName, Key: params.key }));
  return { item: result.Item };
}

async function dynamodbPutItem(params: { tableName: string; item: any }): Promise<any> {
  await dynamodb.send(new PutItemCommand({ TableName: params.tableName, Item: params.item }));
  return { success: true };
}

// SQS Functions
async function sqsListQueues(params: { queueNamePrefix?: string }): Promise<any> {
  const result = await sqs.send(new ListQueuesCommand({ QueueNamePrefix: params.queueNamePrefix }));
  return { queueUrls: result.QueueUrls };
}

async function sqsSendMessage(params: { queueUrl: string; messageBody: string; delaySeconds?: number }): Promise<any> {
  const result = await sqs.send(new SendMessageCommand({ QueueUrl: params.queueUrl, MessageBody: params.messageBody, DelaySeconds: params.delaySeconds }));
  return { messageId: result.MessageId, md5: result.MD5OfMessageBody };
}

async function sqsReceiveMessages(params: { queueUrl: string; maxMessages?: number; waitTimeSeconds?: number }): Promise<any> {
  const result = await sqs.send(new ReceiveMessageCommand({ QueueUrl: params.queueUrl, MaxNumberOfMessages: params.maxMessages, WaitTimeSeconds: params.waitTimeSeconds }));
  return { messages: result.Messages?.map(m => ({ messageId: m.MessageId, body: m.Body, receiptHandle: m.ReceiptHandle })) };
}

async function sqsDeleteMessage(params: { queueUrl: string; receiptHandle: string }): Promise<any> {
  await sqs.send(new DeleteMessageCommand({ QueueUrl: params.queueUrl, ReceiptHandle: params.receiptHandle }));
  return { deleted: true };
}

// SNS Functions
async function snsListTopics(): Promise<any> {
  const result = await sns.send(new ListTopicsCommand({}));
  return { topics: result.Topics?.map(t => ({ topicArn: t.TopicArn })) };
}

async function snsPublish(params: { topicArn: string; message: string; subject?: string }): Promise<any> {
  const result = await sns.send(new PublishCommand({ TopicArn: params.topicArn, Message: params.message, Subject: params.subject }));
  return { messageId: result.MessageId };
}

async function snsListSubscriptions(params: { topicArn?: string }): Promise<any> {
  const result = await sns.send(new ListSubscriptionsCommand({}));
  let subs = result.Subscriptions;
  if (params.topicArn) subs = subs?.filter(s => s.TopicArn === params.topicArn);
  return { subscriptions: subs?.map(s => ({ subscriptionArn: s.SubscriptionArn, protocol: s.Protocol, endpoint: s.Endpoint })) };
}

// IAM Functions
async function iamListUsers(params: { maxItems?: number }): Promise<any> {
  const result = await iam.send(new ListUsersCommand({ MaxItems: params.maxItems }));
  return { users: result.Users?.map(u => ({ userName: u.UserName, userId: u.UserId, arn: u.Arn, createDate: u.CreateDate })) };
}

async function iamListRoles(params: { maxItems?: number }): Promise<any> {
  const result = await iam.send(new ListRolesCommand({ MaxItems: params.maxItems }));
  return { roles: result.Roles?.map(r => ({ roleName: r.RoleName, roleId: r.RoleId, arn: r.Arn })) };
}

async function iamGetUser(params: { userName: string }): Promise<any> {
  const result = await iam.send(new GetUserCommand({ UserName: params.userName }));
  return { user: result.User };
}

// CloudWatch Functions
async function cloudwatchListMetrics(params: { namespace?: string; metricName?: string }): Promise<any> {
  const result = await cloudwatch.send(new ListMetricsCommand({ Namespace: params.namespace, MetricName: params.metricName }));
  return { metrics: result.Metrics?.slice(0, 50).map(m => ({ namespace: m.Namespace, metricName: m.MetricName, dimensions: m.Dimensions })) };
}

async function cloudwatchGetMetricData(params: { metricQueries: any[]; startTime: string; endTime: string }): Promise<any> {
  const result = await cloudwatch.send(new GetMetricDataCommand({
    MetricDataQueries: params.metricQueries,
    StartTime: new Date(params.startTime),
    EndTime: new Date(params.endTime),
  }));
  return { results: result.MetricDataResults };
}

// ECS Functions
async function ecsListClusters(): Promise<any> {
  const result = await ecs.send(new ListClustersCommand({}));
  return { clusterArns: result.clusterArns };
}

async function ecsListServices(params: { cluster: string }): Promise<any> {
  const result = await ecs.send(new ListServicesCommand({ cluster: params.cluster }));
  return { serviceArns: result.serviceArns };
}

async function ecsDescribeServices(params: { cluster: string; services: string[] }): Promise<any> {
  const result = await ecs.send(new DescribeServicesCommand({ cluster: params.cluster, services: params.services }));
  return { services: result.services?.map(s => ({ serviceName: s.serviceName, status: s.status, desiredCount: s.desiredCount, runningCount: s.runningCount })) };
}

async function ecsUpdateService(params: { cluster: string; service: string; desiredCount?: number }): Promise<any> {
  const result = await ecs.send(new UpdateServiceCommand({ cluster: params.cluster, service: params.service, desiredCount: params.desiredCount }));
  return { service: { serviceName: result.service?.serviceName, status: result.service?.status, desiredCount: result.service?.desiredCount } };
}

// RDS Functions
async function rdsDescribeInstances(params: { dbInstanceId?: string }): Promise<any> {
  const result = await rds.send(new DescribeDBInstancesCommand({ DBInstanceIdentifier: params.dbInstanceId }));
  return { instances: result.DBInstances?.map(i => ({ id: i.DBInstanceIdentifier, engine: i.Engine, status: i.DBInstanceStatus, endpoint: i.Endpoint?.Address })) };
}

async function rdsDescribeClusters(params: { dbClusterId?: string }): Promise<any> {
  const result = await rds.send(new DescribeDBClustersCommand({ DBClusterIdentifier: params.dbClusterId }));
  return { clusters: result.DBClusters?.map(c => ({ id: c.DBClusterIdentifier, engine: c.Engine, status: c.Status, endpoint: c.Endpoint })) };
}

const server = new Server({ name: "aws-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      case "s3_list_buckets": result = await s3ListBuckets(); break;
      case "s3_list_objects": result = await s3ListObjects(args as any); break;
      case "s3_get_object": result = await s3GetObject(args as any); break;
      case "s3_put_object": result = await s3PutObject(args as any); break;
      case "s3_delete_object": result = await s3DeleteObject(args as any); break;
      case "ec2_describe_instances": result = await ec2DescribeInstances(args as any); break;
      case "ec2_start_instances": result = await ec2StartInstances(args as any); break;
      case "ec2_stop_instances": result = await ec2StopInstances(args as any); break;
      case "ec2_describe_security_groups": result = await ec2DescribeSecurityGroups(args as any); break;
      case "lambda_list_functions": result = await lambdaListFunctions(args as any); break;
      case "lambda_invoke": result = await lambdaInvoke(args as any); break;
      case "lambda_get_function": result = await lambdaGetFunction(args as any); break;
      case "dynamodb_list_tables": result = await dynamodbListTables(args as any); break;
      case "dynamodb_scan": result = await dynamodbScan(args as any); break;
      case "dynamodb_get_item": result = await dynamodbGetItem(args as any); break;
      case "dynamodb_put_item": result = await dynamodbPutItem(args as any); break;
      case "sqs_list_queues": result = await sqsListQueues(args as any); break;
      case "sqs_send_message": result = await sqsSendMessage(args as any); break;
      case "sqs_receive_messages": result = await sqsReceiveMessages(args as any); break;
      case "sqs_delete_message": result = await sqsDeleteMessage(args as any); break;
      case "sns_list_topics": result = await snsListTopics(); break;
      case "sns_publish": result = await snsPublish(args as any); break;
      case "sns_list_subscriptions": result = await snsListSubscriptions(args as any); break;
      case "iam_list_users": result = await iamListUsers(args as any); break;
      case "iam_list_roles": result = await iamListRoles(args as any); break;
      case "iam_get_user": result = await iamGetUser(args as any); break;
      case "cloudwatch_list_metrics": result = await cloudwatchListMetrics(args as any); break;
      case "cloudwatch_get_metric_data": result = await cloudwatchGetMetricData(args as any); break;
      case "ecs_list_clusters": result = await ecsListClusters(); break;
      case "ecs_list_services": result = await ecsListServices(args as any); break;
      case "ecs_describe_services": result = await ecsDescribeServices(args as any); break;
      case "ecs_update_service": result = await ecsUpdateService(args as any); break;
      case "rds_describe_instances": result = await rdsDescribeInstances(args as any); break;
      case "rds_describe_clusters": result = await rdsDescribeClusters(args as any); break;
      default: throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("AWS MCP Server running on stdio");
}

main().catch(console.error);
