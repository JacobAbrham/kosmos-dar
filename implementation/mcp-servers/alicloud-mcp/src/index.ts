/**
 * Alibaba Cloud MCP Server - Alibaba Cloud integration for KOSMOS
 * Provides access to core Alibaba Cloud services including ECS, OSS, RDS, SLB, VPC, DNS, CDN, SMS
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, Tool } from "@modelcontextprotocol/sdk/types.js";
import * as $OpenApi from "@alicloud/openapi-client";
import Ecs20140526, * as $Ecs20140526 from "@alicloud/ecs20140526";
import Rds20140815, * as $Rds20140815 from "@alicloud/rds20140815";
import Slb20140515, * as $Slb20140515 from "@alicloud/slb20140515";
import Vpc20160428, * as $Vpc20160428 from "@alicloud/vpc20160428";
import Alidns20150109, * as $Alidns20150109 from "@alicloud/alidns20150109";
import Cdn20180510, * as $Cdn20180510 from "@alicloud/cdn20180510";
import Dysmsapi20170525, * as $Dysmsapi20170525 from "@alicloud/dysmsapi20170525";
import BssOpenApi20171214, * as $BssOpenApi20171214 from "@alicloud/bssopenapi20171214";
import OSS from "ali-oss";

// Configuration from environment variables
const config = {
  accessKeyId: process.env.ALICLOUD_ACCESS_KEY || "",
  accessKeySecret: process.env.ALICLOUD_SECRET_KEY || "",
  region: process.env.ALICLOUD_REGION || "cn-hangzhou",
};

// Create OpenAPI config
function createConfig(endpoint: string): $OpenApi.Config {
  return new $OpenApi.Config({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: endpoint,
  });
}

// Initialize clients
const ecsClient = new Ecs20140526(createConfig(`ecs.${config.region}.aliyuncs.com`));
const rdsClient = new Rds20140815(createConfig(`rds.${config.region}.aliyuncs.com`));
const slbClient = new Slb20140515(createConfig(`slb.${config.region}.aliyuncs.com`));
const vpcClient = new Vpc20160428(createConfig(`vpc.${config.region}.aliyuncs.com`));
const dnsClient = new Alidns20150109(createConfig("alidns.aliyuncs.com"));
const cdnClient = new Cdn20180510(createConfig("cdn.aliyuncs.com"));
const smsClient = new Dysmsapi20170525(createConfig("dysmsapi.aliyuncs.com"));
const bssClient = new BssOpenApi20171214(createConfig("business.aliyuncs.com"));

// OSS client factory (per-bucket)
function createOssClient(bucket?: string, region?: string): OSS {
  return new OSS({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    region: region || config.region,
    bucket: bucket,
  });
}

// Tool definitions
const TOOLS: Tool[] = [
  // ECS - Elastic Compute Service
  {
    name: "list_ecs_instances",
    description: "List ECS instances in the specified region.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID (e.g., cn-hangzhou)" },
        pageNumber: { type: "number", description: "Page number (default: 1)" },
        pageSize: { type: "number", description: "Page size (default: 10, max: 100)" },
        instanceIds: { type: "array", items: { type: "string" }, description: "Filter by instance IDs" },
        status: { type: "string", description: "Filter by status (Running, Stopped, Starting, Stopping)" },
      },
    },
  },
  {
    name: "get_ecs_instance",
    description: "Get detailed information about a specific ECS instance.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID" },
        instanceId: { type: "string", description: "Instance ID" },
      },
      required: ["instanceId"],
    },
  },
  {
    name: "start_instance",
    description: "Start an ECS instance.",
    inputSchema: {
      type: "object",
      properties: {
        instanceId: { type: "string", description: "Instance ID to start" },
      },
      required: ["instanceId"],
    },
  },
  {
    name: "stop_instance",
    description: "Stop an ECS instance.",
    inputSchema: {
      type: "object",
      properties: {
        instanceId: { type: "string", description: "Instance ID to stop" },
        forceStop: { type: "boolean", description: "Force stop (default: false)" },
        stoppedMode: { type: "string", description: "Stopped mode: StopCharging or KeepCharging" },
      },
      required: ["instanceId"],
    },
  },
  // OSS - Object Storage Service
  {
    name: "list_oss_buckets",
    description: "List all OSS buckets.",
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "Filter buckets by prefix" },
        marker: { type: "string", description: "Pagination marker" },
        maxKeys: { type: "number", description: "Maximum number of buckets to return" },
      },
    },
  },
  {
    name: "list_oss_objects",
    description: "List objects in an OSS bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        prefix: { type: "string", description: "Object key prefix" },
        marker: { type: "string", description: "Pagination marker" },
        maxKeys: { type: "number", description: "Maximum number of objects (default: 100)" },
        delimiter: { type: "string", description: "Delimiter for grouping objects" },
      },
      required: ["bucket"],
    },
  },
  {
    name: "get_oss_object",
    description: "Get an object from OSS bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Object key" },
        region: { type: "string", description: "Bucket region (optional)" },
      },
      required: ["bucket", "key"],
    },
  },
  {
    name: "put_oss_object",
    description: "Upload an object to OSS bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Object key" },
        body: { type: "string", description: "Object content" },
        contentType: { type: "string", description: "Content type (optional)" },
        region: { type: "string", description: "Bucket region (optional)" },
      },
      required: ["bucket", "key", "body"],
    },
  },
  {
    name: "delete_oss_object",
    description: "Delete an object from OSS bucket.",
    inputSchema: {
      type: "object",
      properties: {
        bucket: { type: "string", description: "Bucket name" },
        key: { type: "string", description: "Object key" },
        region: { type: "string", description: "Bucket region (optional)" },
      },
      required: ["bucket", "key"],
    },
  },
  // RDS - Relational Database Service
  {
    name: "list_rds_instances",
    description: "List RDS database instances.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID" },
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
        dbInstanceId: { type: "string", description: "Filter by instance ID" },
        dbInstanceStatus: { type: "string", description: "Filter by status" },
        engine: { type: "string", description: "Filter by engine (MySQL, SQLServer, PostgreSQL, MariaDB)" },
      },
    },
  },
  {
    name: "get_rds_instance",
    description: "Get detailed information about an RDS instance.",
    inputSchema: {
      type: "object",
      properties: {
        dbInstanceId: { type: "string", description: "RDS instance ID" },
      },
      required: ["dbInstanceId"],
    },
  },
  // SLB - Server Load Balancer
  {
    name: "list_slb_instances",
    description: "List SLB load balancer instances.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID" },
        loadBalancerId: { type: "string", description: "Filter by load balancer ID" },
        loadBalancerName: { type: "string", description: "Filter by name" },
        loadBalancerStatus: { type: "string", description: "Filter by status" },
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
      },
    },
  },
  // VPC - Virtual Private Cloud
  {
    name: "list_vpcs",
    description: "List VPCs in the specified region.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID" },
        vpcId: { type: "string", description: "Filter by VPC ID" },
        vpcName: { type: "string", description: "Filter by VPC name" },
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
      },
    },
  },
  {
    name: "list_security_groups",
    description: "List security groups.",
    inputSchema: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID" },
        vpcId: { type: "string", description: "Filter by VPC ID" },
        securityGroupId: { type: "string", description: "Filter by security group ID" },
        securityGroupName: { type: "string", description: "Filter by name" },
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
      },
    },
  },
  // Regions
  {
    name: "list_regions",
    description: "List all available Alibaba Cloud regions.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // Billing
  {
    name: "get_account_balance",
    description: "Get the account balance.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  // CDN
  {
    name: "list_cdn_domains",
    description: "List CDN domains.",
    inputSchema: {
      type: "object",
      properties: {
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
        domainName: { type: "string", description: "Filter by domain name" },
        domainStatus: { type: "string", description: "Filter by status (online, offline, configuring)" },
      },
    },
  },
  // SMS
  {
    name: "send_sms",
    description: "Send SMS message via Alibaba Cloud SMS service.",
    inputSchema: {
      type: "object",
      properties: {
        phoneNumbers: { type: "string", description: "Phone number(s), comma-separated for multiple" },
        signName: { type: "string", description: "SMS signature name" },
        templateCode: { type: "string", description: "SMS template code" },
        templateParam: { type: "string", description: "Template parameters as JSON string" },
      },
      required: ["phoneNumbers", "signName", "templateCode"],
    },
  },
  // DNS
  {
    name: "list_dns_records",
    description: "List DNS records for a domain.",
    inputSchema: {
      type: "object",
      properties: {
        domainName: { type: "string", description: "Domain name" },
        rrKeyWord: { type: "string", description: "Filter by record keyword" },
        typeKeyWord: { type: "string", description: "Filter by record type (A, CNAME, MX, TXT, etc.)" },
        pageNumber: { type: "number", description: "Page number" },
        pageSize: { type: "number", description: "Page size" },
      },
      required: ["domainName"],
    },
  },
  {
    name: "create_dns_record",
    description: "Create a DNS record.",
    inputSchema: {
      type: "object",
      properties: {
        domainName: { type: "string", description: "Domain name" },
        rr: { type: "string", description: "Record name (e.g., www, @)" },
        type: { type: "string", description: "Record type (A, CNAME, MX, TXT, AAAA, NS, SRV, etc.)" },
        value: { type: "string", description: "Record value" },
        ttl: { type: "number", description: "TTL in seconds (default: 600)" },
        priority: { type: "number", description: "Priority for MX records" },
        line: { type: "string", description: "Resolution line (default: default)" },
      },
      required: ["domainName", "rr", "type", "value"],
    },
  },
];

// ECS Functions
async function listEcsInstances(params: {
  regionId?: string;
  pageNumber?: number;
  pageSize?: number;
  instanceIds?: string[];
  status?: string;
}): Promise<any> {
  const request = new $Ecs20140526.DescribeInstancesRequest({
    regionId: params.regionId || config.region,
    pageNumber: params.pageNumber || 1,
    pageSize: params.pageSize || 10,
    instanceIds: params.instanceIds ? JSON.stringify(params.instanceIds) : undefined,
    status: params.status,
  });
  const response = await ecsClient.describeInstances(request);
  return {
    instances: response.body?.instances?.instance?.map((i: any) => ({
      instanceId: i.instanceId,
      instanceName: i.instanceName,
      status: i.status,
      instanceType: i.instanceType,
      regionId: i.regionId,
      zoneId: i.zoneId,
      publicIpAddress: i.publicIpAddress?.ipAddress,
      privateIpAddress: i.vpcAttributes?.privateIpAddress?.ipAddress,
      creationTime: i.creationTime,
      expiredTime: i.expiredTime,
      osName: i.osName,
      cpu: i.cpu,
      memory: i.memory,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

async function getEcsInstance(params: { regionId?: string; instanceId: string }): Promise<any> {
  const request = new $Ecs20140526.DescribeInstancesRequest({
    regionId: params.regionId || config.region,
    instanceIds: JSON.stringify([params.instanceId]),
  });
  const response = await ecsClient.describeInstances(request);
  const instance = response.body?.instances?.instance?.[0];
  if (!instance) {
    throw new Error(`Instance ${params.instanceId} not found`);
  }
  return {
    instanceId: instance.instanceId,
    instanceName: instance.instanceName,
    status: instance.status,
    instanceType: instance.instanceType,
    regionId: instance.regionId,
    zoneId: instance.zoneId,
    publicIpAddress: instance.publicIpAddress?.ipAddress,
    privateIpAddress: instance.vpcAttributes?.privateIpAddress?.ipAddress,
    vpcId: instance.vpcAttributes?.vpcId,
    vSwitchId: instance.vpcAttributes?.vSwitchId,
    securityGroupIds: instance.securityGroupIds?.securityGroupId,
    creationTime: instance.creationTime,
    startTime: instance.startTime,
    expiredTime: instance.expiredTime,
    osName: instance.osName,
    osType: instance.osType,
    cpu: instance.cpu,
    memory: instance.memory,
    internetMaxBandwidthIn: instance.internetMaxBandwidthIn,
    internetMaxBandwidthOut: instance.internetMaxBandwidthOut,
    internetChargeType: instance.internetChargeType,
    instanceChargeType: instance.instanceChargeType,
    description: instance.description,
  };
}

async function startInstance(params: { instanceId: string }): Promise<any> {
  const request = new $Ecs20140526.StartInstanceRequest({
    instanceId: params.instanceId,
  });
  await ecsClient.startInstance(request);
  return { success: true, instanceId: params.instanceId, action: "starting" };
}

async function stopInstance(params: { instanceId: string; forceStop?: boolean; stoppedMode?: string }): Promise<any> {
  const request = new $Ecs20140526.StopInstanceRequest({
    instanceId: params.instanceId,
    forceStop: params.forceStop || false,
    stoppedMode: params.stoppedMode,
  });
  await ecsClient.stopInstance(request);
  return { success: true, instanceId: params.instanceId, action: "stopping" };
}

// OSS Functions
async function listOssBuckets(params: { prefix?: string; marker?: string; maxKeys?: number }): Promise<any> {
  const client = createOssClient();
  const result = await client.listBuckets({
    prefix: params.prefix,
    marker: params.marker,
    "max-keys": params.maxKeys,
  });
  return {
    buckets: result.buckets?.map((b: any) => ({
      name: b.name,
      region: b.region,
      creationDate: b.creationDate,
      storageClass: b.storageClass,
    })),
    isTruncated: result.isTruncated,
    nextMarker: result.nextMarker,
  };
}

async function listOssObjects(params: {
  bucket: string;
  prefix?: string;
  marker?: string;
  maxKeys?: number;
  delimiter?: string;
}): Promise<any> {
  const client = createOssClient(params.bucket);
  const result = await client.list({
    prefix: params.prefix,
    marker: params.marker,
    "max-keys": params.maxKeys || 100,
    delimiter: params.delimiter,
  }, {});
  return {
    objects: result.objects?.map((o: any) => ({
      name: o.name,
      size: o.size,
      lastModified: o.lastModified,
      etag: o.etag,
      storageClass: o.storageClass,
    })),
    prefixes: result.prefixes,
    isTruncated: result.isTruncated,
    nextMarker: result.nextMarker,
  };
}

async function getOssObject(params: { bucket: string; key: string; region?: string }): Promise<any> {
  const client = createOssClient(params.bucket, params.region);
  const result = await client.get(params.key);
  return {
    content: result.content?.toString("utf-8"),
    contentType: result.res?.headers?.["content-type"],
    contentLength: result.res?.headers?.["content-length"],
    lastModified: result.res?.headers?.["last-modified"],
    etag: result.res?.headers?.etag,
  };
}

async function putOssObject(params: {
  bucket: string;
  key: string;
  body: string;
  contentType?: string;
  region?: string;
}): Promise<any> {
  const client = createOssClient(params.bucket, params.region);
  const options: any = {};
  if (params.contentType) {
    options.headers = { "Content-Type": params.contentType };
  }
  const result = await client.put(params.key, Buffer.from(params.body), options);
  return {
    success: true,
    name: result.name,
    url: result.url,
    etag: result.res?.headers?.etag,
  };
}

async function deleteOssObject(params: { bucket: string; key: string; region?: string }): Promise<any> {
  const client = createOssClient(params.bucket, params.region);
  await client.delete(params.key);
  return { deleted: true, bucket: params.bucket, key: params.key };
}

// RDS Functions
async function listRdsInstances(params: {
  regionId?: string;
  pageNumber?: number;
  pageSize?: number;
  dbInstanceId?: string;
  dbInstanceStatus?: string;
  engine?: string;
}): Promise<any> {
  const request = new $Rds20140815.DescribeDBInstancesRequest({
    regionId: params.regionId || config.region,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
    DBInstanceId: params.dbInstanceId,
    DBInstanceStatus: params.dbInstanceStatus,
    engine: params.engine,
  });
  const response = await rdsClient.describeDBInstances(request);
  return {
    instances: response.body?.items?.DBInstance?.map((i: any) => ({
      dbInstanceId: i.DBInstanceId,
      dbInstanceDescription: i.DBInstanceDescription,
      dbInstanceStatus: i.DBInstanceStatus,
      dbInstanceType: i.DBInstanceType,
      engine: i.engine,
      engineVersion: i.engineVersion,
      regionId: i.regionId,
      zoneId: i.zoneId,
      dbInstanceClass: i.DBInstanceClass,
      dbInstanceNetType: i.DBInstanceNetType,
      connectionString: i.connectionString,
      createTime: i.createTime,
      expireTime: i.expireTime,
      payType: i.payType,
      vpcId: i.vpcId,
      vSwitchId: i.vSwitchId,
    })),
    totalRecordCount: response.body?.totalRecordCount,
    pageNumber: response.body?.pageNumber,
    pageRecordCount: response.body?.pageRecordCount,
  };
}

async function getRdsInstance(params: { dbInstanceId: string }): Promise<any> {
  const request = new $Rds20140815.DescribeDBInstanceAttributeRequest({
    DBInstanceId: params.dbInstanceId,
  });
  const response = await rdsClient.describeDBInstanceAttribute(request);
  const instance = response.body?.items?.DBInstanceAttribute?.[0];
  if (!instance) {
    throw new Error(`RDS instance ${params.dbInstanceId} not found`);
  }
  return {
    dbInstanceId: instance.DBInstanceId,
    dbInstanceDescription: instance.DBInstanceDescription,
    dbInstanceStatus: instance.DBInstanceStatus,
    dbInstanceType: instance.DBInstanceType,
    engine: instance.engine,
    engineVersion: instance.engineVersion,
    regionId: instance.regionId,
    zoneId: instance.zoneId,
    dbInstanceClass: instance.DBInstanceClass,
    dbInstanceStorage: instance.DBInstanceStorage,
    dbInstanceMemory: instance.DBInstanceMemory,
    dbInstanceCPU: instance.DBInstanceCPU,
    maxConnections: instance.maxConnections,
    maxIOPS: instance.maxIOPS,
    connectionString: instance.connectionString,
    port: instance.port,
    createTime: instance.createTime,
    expireTime: instance.expireTime,
    payType: instance.payType,
    vpcId: instance.vpcId,
    vSwitchId: instance.vSwitchId,
    securityIPList: instance.securityIPList,
  };
}

// SLB Functions
async function listSlbInstances(params: {
  regionId?: string;
  loadBalancerId?: string;
  loadBalancerName?: string;
  loadBalancerStatus?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<any> {
  const request = new $Slb20140515.DescribeLoadBalancersRequest({
    regionId: params.regionId || config.region,
    loadBalancerId: params.loadBalancerId,
    loadBalancerName: params.loadBalancerName,
    loadBalancerStatus: params.loadBalancerStatus,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
  });
  const response = await slbClient.describeLoadBalancers(request);
  return {
    loadBalancers: response.body?.loadBalancers?.loadBalancer?.map((lb: any) => ({
      loadBalancerId: lb.loadBalancerId,
      loadBalancerName: lb.loadBalancerName,
      loadBalancerStatus: lb.loadBalancerStatus,
      address: lb.address,
      addressType: lb.addressType,
      networkType: lb.networkType,
      vpcId: lb.vpcId,
      vSwitchId: lb.vSwitchId,
      regionId: lb.regionId,
      createTime: lb.createTime,
      payType: lb.payType,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

// VPC Functions
async function listVpcs(params: {
  regionId?: string;
  vpcId?: string;
  vpcName?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<any> {
  const request = new $Vpc20160428.DescribeVpcsRequest({
    regionId: params.regionId || config.region,
    vpcId: params.vpcId,
    vpcName: params.vpcName,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
  });
  const response = await vpcClient.describeVpcs(request);
  return {
    vpcs: response.body?.vpcs?.vpc?.map((v: any) => ({
      vpcId: v.vpcId,
      vpcName: v.vpcName,
      status: v.status,
      cidrBlock: v.cidrBlock,
      vSwitchIds: v.vSwitchIds?.vSwitchId,
      routerTableIds: v.routerTableIds?.routerTableId,
      regionId: v.regionId,
      creationTime: v.creationTime,
      description: v.description,
      isDefault: v.isDefault,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

async function listSecurityGroups(params: {
  regionId?: string;
  vpcId?: string;
  securityGroupId?: string;
  securityGroupName?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<any> {
  const request = new $Ecs20140526.DescribeSecurityGroupsRequest({
    regionId: params.regionId || config.region,
    vpcId: params.vpcId,
    securityGroupId: params.securityGroupId,
    securityGroupName: params.securityGroupName,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
  });
  const response = await ecsClient.describeSecurityGroups(request);
  return {
    securityGroups: response.body?.securityGroups?.securityGroup?.map((sg: any) => ({
      securityGroupId: sg.securityGroupId,
      securityGroupName: sg.securityGroupName,
      description: sg.description,
      vpcId: sg.vpcId,
      securityGroupType: sg.securityGroupType,
      creationTime: sg.creationTime,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

// Region Functions
async function listRegions(): Promise<any> {
  const request = new $Ecs20140526.DescribeRegionsRequest({});
  const response = await ecsClient.describeRegions(request);
  return {
    regions: response.body?.regions?.region?.map((r: any) => ({
      regionId: r.regionId,
      localName: r.localName,
      regionEndpoint: r.regionEndpoint,
      status: r.status,
    })),
  };
}

// Billing Functions
async function getAccountBalance(): Promise<any> {
  const request = new $BssOpenApi20171214.QueryAccountBalanceRequest({});
  const response = await bssClient.queryAccountBalance(request);
  return {
    availableAmount: response.body?.data?.availableAmount,
    currency: response.body?.data?.currency,
    availableCashAmount: response.body?.data?.availableCashAmount,
    creditAmount: response.body?.data?.creditAmount,
    mybankCreditAmount: response.body?.data?.mybankCreditAmount,
  };
}

// CDN Functions
async function listCdnDomains(params: {
  pageNumber?: number;
  pageSize?: number;
  domainName?: string;
  domainStatus?: string;
}): Promise<any> {
  const request = new $Cdn20180510.DescribeUserDomainsRequest({
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
    domainName: params.domainName,
    domainStatus: params.domainStatus,
  });
  const response = await cdnClient.describeUserDomains(request);
  return {
    domains: response.body?.domains?.pageData?.map((d: any) => ({
      domainName: d.domainName,
      domainStatus: d.domainStatus,
      cname: d.cname,
      cdnType: d.cdnType,
      gmtCreated: d.gmtCreated,
      gmtModified: d.gmtModified,
      description: d.description,
      sslProtocol: d.sslProtocol,
      resourceGroupId: d.resourceGroupId,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

// SMS Functions
async function sendSms(params: {
  phoneNumbers: string;
  signName: string;
  templateCode: string;
  templateParam?: string;
}): Promise<any> {
  const request = new $Dysmsapi20170525.SendSmsRequest({
    phoneNumbers: params.phoneNumbers,
    signName: params.signName,
    templateCode: params.templateCode,
    templateParam: params.templateParam,
  });
  const response = await smsClient.sendSms(request);
  return {
    code: response.body?.code,
    message: response.body?.message,
    bizId: response.body?.bizId,
    requestId: response.body?.requestId,
  };
}

// DNS Functions
async function listDnsRecords(params: {
  domainName: string;
  rrKeyWord?: string;
  typeKeyWord?: string;
  pageNumber?: number;
  pageSize?: number;
}): Promise<any> {
  const request = new $Alidns20150109.DescribeDomainRecordsRequest({
    domainName: params.domainName,
    RRKeyWord: params.rrKeyWord,
    typeKeyWord: params.typeKeyWord,
    pageNumber: params.pageNumber,
    pageSize: params.pageSize,
  });
  const response = await dnsClient.describeDomainRecords(request);
  return {
    records: response.body?.domainRecords?.record?.map((r: any) => ({
      recordId: r.recordId,
      rr: r.RR,
      type: r.type,
      value: r.value,
      ttl: r.TTL,
      priority: r.priority,
      line: r.line,
      status: r.status,
      locked: r.locked,
    })),
    totalCount: response.body?.totalCount,
    pageNumber: response.body?.pageNumber,
    pageSize: response.body?.pageSize,
  };
}

async function createDnsRecord(params: {
  domainName: string;
  rr: string;
  type: string;
  value: string;
  ttl?: number;
  priority?: number;
  line?: string;
}): Promise<any> {
  const request = new $Alidns20150109.AddDomainRecordRequest({
    domainName: params.domainName,
    RR: params.rr,
    type: params.type,
    value: params.value,
    TTL: params.ttl || 600,
    priority: params.priority,
    line: params.line || "default",
  });
  const response = await dnsClient.addDomainRecord(request);
  return {
    recordId: response.body?.recordId,
    requestId: response.body?.requestId,
  };
}

// Server setup
const server = new Server(
  { name: "alicloud-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    let result: any;
    switch (name) {
      // ECS
      case "list_ecs_instances":
        result = await listEcsInstances(args as any);
        break;
      case "get_ecs_instance":
        result = await getEcsInstance(args as any);
        break;
      case "start_instance":
        result = await startInstance(args as any);
        break;
      case "stop_instance":
        result = await stopInstance(args as any);
        break;
      // OSS
      case "list_oss_buckets":
        result = await listOssBuckets(args as any);
        break;
      case "list_oss_objects":
        result = await listOssObjects(args as any);
        break;
      case "get_oss_object":
        result = await getOssObject(args as any);
        break;
      case "put_oss_object":
        result = await putOssObject(args as any);
        break;
      case "delete_oss_object":
        result = await deleteOssObject(args as any);
        break;
      // RDS
      case "list_rds_instances":
        result = await listRdsInstances(args as any);
        break;
      case "get_rds_instance":
        result = await getRdsInstance(args as any);
        break;
      // SLB
      case "list_slb_instances":
        result = await listSlbInstances(args as any);
        break;
      // VPC
      case "list_vpcs":
        result = await listVpcs(args as any);
        break;
      case "list_security_groups":
        result = await listSecurityGroups(args as any);
        break;
      // Regions
      case "list_regions":
        result = await listRegions();
        break;
      // Billing
      case "get_account_balance":
        result = await getAccountBalance();
        break;
      // CDN
      case "list_cdn_domains":
        result = await listCdnDomains(args as any);
        break;
      // SMS
      case "send_sms":
        result = await sendSms(args as any);
        break;
      // DNS
      case "list_dns_records":
        result = await listDnsRecords(args as any);
        break;
      case "create_dns_record":
        result = await createDnsRecord(args as any);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (error: any) {
    return { content: [{ type: "text", text: JSON.stringify({ error: error.message }) }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Alibaba Cloud MCP Server running on stdio");
}

main().catch(console.error);
