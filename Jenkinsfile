// Optional: trusted branches only, on a dedicated Linux agent with Docker Compose.
// No Shopify credentials are needed. Deployment remains an explicit operator step.
pipeline {
    agent { label 'docker' }
    options { disableConcurrentBuilds(); timestamps(); timeout(time: 45, unit: 'MINUTES') }
    stages {
        stage('Checkout') { steps { checkout scm } }
        stage('Prepare') {
            steps {
                script {
                    env.CI_PROJECT = "keycaps-ci-${env.BUILD_NUMBER}-${env.JOB_NAME.hashCode().abs()}"
                    env.RELEASE_TAG = sh(script: 'git rev-parse HEAD', returnStdout: true).trim()
                }
            }
        }
        stage('Unit and API tests') {
            steps { sh 'docker compose -p "$CI_PROJECT" -f compose.yaml -f compose.test.yaml --profile test run --build --rm unit' }
        }
        stage('Playwright') {
            steps { sh 'docker compose -p "$CI_PROJECT" -f compose.yaml -f compose.test.yaml --profile test run --build --rm e2e' }
        }
        stage('Release images') {
            steps {
                sh 'docker build -f docker/release.Dockerfile --target api -t keycaps/api:$RELEASE_TAG .'
                sh 'docker build -f docker/release.Dockerfile --target web -t keycaps/web:$RELEASE_TAG .'
                sh 'docker run --rm --read-only --tmpfs /tmp --mount type=bind,src="$WORKSPACE/tests/scripts/release-smoke.mjs",dst=/app/release-smoke.mjs,readonly keycaps/api:$RELEASE_TAG node release-smoke.mjs'
                sh 'docker run --rm --entrypoint caddy -e SITE_ADDRESS=https://fixture.example.com keycaps/web:$RELEASE_TAG validate --config /etc/caddy/Caddyfile --adapter caddyfile'
            }
        }
    }
    post {
        always {
            archiveArtifacts artifacts: 'tests/e2e/playwright-report/**,tests/e2e/test-results/**', allowEmptyArchive: true
            sh 'docker compose -p "$CI_PROJECT" -f compose.yaml -f compose.test.yaml --profile test down --remove-orphans'
        }
    }
}
