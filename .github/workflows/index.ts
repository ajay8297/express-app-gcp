import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

// Create a Pub/Sub Topic
const pubsubTopic = new gcp.pubsub.Topic("rate-limit-topic");

// Create a Cloud Run service
const cloudRunService = new gcp.cloudrun.Service("express-service", {
    location: "us-central1",
    template: {
        spec: {
            containers: [
                {
                    image: "gcr.io/final-project-443911/express-gcp-app",
                    ports: [{ containerPort: 8081 }], // Change the port to 8081 to avoid conflicts
                    envs: [
                        { name: "PUBSUB_TOPIC", value: pubsubTopic.name },
                    ],
                },
            ],
        },
    },
});

// Allow unauthenticated access to Cloud Run
new gcp.cloudrun.IamMember("unauthenticated-access", {
    service: cloudRunService.name,
    location: cloudRunService.location,
    role: "roles/run.invoker",
    member: "allUsers",
});

// Create IAM Role for Cloud Run to Publish to Pub/Sub
const cloudRunPubSubPolicy = new gcp.pubsub.TopicIAMBinding("cloud-run-pubsub", {
    topic: pubsubTopic.name,
    role: "roles/pubsub.publisher",
    members: [pulumi.interpolate`serviceAccount:${cloudRunService.spec.template.spec.containers[0].name}@${gcp.config.project}.iam.gserviceaccount.com`],
});

// Export the Cloud Run Service URL
export const url = cloudRunService.status.url;
