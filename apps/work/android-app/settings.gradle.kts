pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories { google(); mavenCentral() }
}
rootProject.name = "NOSMOWork"
include(":app")

// Optional native add-on. The default Work build does not contain its services.
if (providers.gradleProperty("nosmoCommunicationsArchive").orNull == "true") {
    include(":communicationsArchive")
    project(":communicationsArchive").projectDir = file("../../../addons/communications-archive/android/library")
}
