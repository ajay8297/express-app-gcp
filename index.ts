import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Define the GCP project and region
const config = new pulumi.Config();
const project = config.require("gcp:project");
const region = config.require("gcp:region");

// Create a GCP container registry
const imageName = "button-click-tracker";
const image = new gcp.container.Registry(imageName, {});

// Build and push the Docker image
const imageUri = pulumi.interpolate`gcr.io/${project}/${imageName}`;
const dockerBuild = new gcp.cloudbuild.Trigger("dockerBuild", {
    filename: "cloudbuild.yaml",
    substitutions: {
        _IMAGE: imageUri,
    },
});

// Create a Cloud Run service
const service = new gcp.cloudrun.Service("button-click-tracker-service", {
    location: region,
    template: {
        spec: {
            containers: [{
                image: imageUri,
                envs: [
                    { name: "FIREBASE_CONFIG", value: '{"projectId":"your-project-id","databaseURL":"https://your-project-id.firebaseio.com"}' },
                ],
            }],
        },
    },
});

// Allow unauthenticated access
const iam = new gcp.cloudrun.IamMember("button-click-tracker-iam", {
    service: service.name,
    location: service.location,
    role: "roles/run.invoker",
    member: "allUsers",
});

// Export the URL of the service
export const url = service.statuses[0].url;
