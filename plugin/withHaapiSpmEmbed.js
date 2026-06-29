const { createRunOncePlugin, withXcodeProject } = require('expo/config-plugins');

const pkg = require('../package.json');

// iOS pins the HAAPI SDK from the per-platform source of truth in package.json
// (`haapi.ios.version`). Android tracks its own `haapi.android.version`.
const HAAPI_IOS_VERSION = pkg.haapi.ios.version;

const SPM_PACKAGE_URL = 'https://github.com/curityio/ios-idsvr-haapi-sdk-dist.git';
const SPM_PACKAGE_URL_NO_GIT = 'https://github.com/curityio/ios-idsvr-haapi-sdk-dist';
const SPM_PRODUCT_NAME = 'IdsvrHaapiSdk';
// pbxproj object-type identifiers — each is used as both the objects-section
// key and the object's `isa`. Centralized so the two stay in sync and to avoid typos.
const REMOTE_PACKAGE_REF_TYPE = 'XCRemoteSwiftPackageReference';
const PRODUCT_DEPENDENCY_TYPE = 'XCSwiftPackageProductDependency';
// Human-readable pbxproj annotation for the SPM package reference.
const SPM_PACKAGE_REF_COMMENT = 'ios-idsvr-haapi-sdk-dist';

function normalizeQuoted(value) {
  return String(value ?? '').replace(/^"|"$/g, '');
}

function getRefValue(ref) {
  if (typeof ref === 'string') {
    return ref;
  }

  return ref?.value;
}

function ensureSection(project, sectionName) {
  if (!project.hash?.project?.objects?.[sectionName]) {
    project.hash.project.objects[sectionName] = {};
  }

  return project.hash.project.objects[sectionName];
}

function ensurePackageReferenceOnRootProject(project, packageReferenceUuid) {
  const firstProject = project.getFirstProject();
  const firstProjectUuid =
    getRefValue(firstProject?.firstProject) || getRefValue(firstProject?.uuid);
  if (!firstProjectUuid) {
    return;
  }

  const projectSection = project.pbxProjectSection();
  const rootProject = projectSection[firstProjectUuid];
  if (!rootProject) {
    return;
  }

  if (!Array.isArray(rootProject.packageReferences)) {
    rootProject.packageReferences = [];
  }

  const alreadyAdded = rootProject.packageReferences.some(
    (ref) => getRefValue(ref) === packageReferenceUuid
  );

  if (!alreadyAdded) {
    rootProject.packageReferences.push({
      value: packageReferenceUuid,
      comment: SPM_PACKAGE_REF_COMMENT,
    });
  }
}

function ensureRemoteSwiftPackageReference(project) {
  const section = ensureSection(project, REMOTE_PACKAGE_REF_TYPE);

  const existingKey = Object.keys(section).find((key) => {
    if (key.endsWith('_comment')) {
      return false;
    }

    const ref = section[key];
    const repositoryURL = normalizeQuoted(ref?.repositoryURL);
    return (
      repositoryURL === SPM_PACKAGE_URL || repositoryURL === SPM_PACKAGE_URL_NO_GIT
    );
  });

  if (existingKey) {
    // Keep the pinned version in lockstep with package.json on every prebuild,
    // including incremental (non --clean) runs that reuse the existing reference.
    section[existingKey].requirement = {
      kind: 'exactVersion',
      version: HAAPI_IOS_VERSION,
    };
    ensurePackageReferenceOnRootProject(project, existingKey);
    return existingKey;
  }

  const uuid = project.generateUuid();
  section[uuid] = {
    isa: REMOTE_PACKAGE_REF_TYPE,
    repositoryURL: `"${SPM_PACKAGE_URL}"`,
    requirement: {
      kind: 'exactVersion',
      version: HAAPI_IOS_VERSION,
    },
  };
  section[`${uuid}_comment`] = SPM_PACKAGE_REF_COMMENT;

  ensurePackageReferenceOnRootProject(project, uuid);
  return uuid;
}

function getApplicationTargetEntries(project) {
  const targets = project.pbxNativeTargetSection();

  return Object.entries(targets).filter(([key, target]) => {
    if (key.endsWith('_comment')) {
      return false;
    }

    return (
      normalizeQuoted(target?.productType) === 'com.apple.product-type.application'
    );
  });
}

function ensureSwiftPackageProductDependency(project, packageReferenceUuid, target) {
  const section = ensureSection(project, PRODUCT_DEPENDENCY_TYPE);

  const existingKey = Object.keys(section).find((key) => {
    if (key.endsWith('_comment')) {
      return false;
    }

    const dep = section[key];
    const productName = normalizeQuoted(dep?.productName);
    return (
      productName === SPM_PRODUCT_NAME &&
      getRefValue(dep?.package) === packageReferenceUuid
    );
  });

  const dependencyUuid = existingKey || project.generateUuid();

  if (!existingKey) {
    section[dependencyUuid] = {
      isa: PRODUCT_DEPENDENCY_TYPE,
      productName: `"${SPM_PRODUCT_NAME}"`,
      package: packageReferenceUuid,
      package_comment: SPM_PACKAGE_REF_COMMENT,
    };
    section[`${dependencyUuid}_comment`] = SPM_PRODUCT_NAME;
  }

  if (!Array.isArray(target.packageProductDependencies)) {
    target.packageProductDependencies = [];
  }

  const targetAlreadyLinksDependency = target.packageProductDependencies.some(
    (dep) => getRefValue(dep) === dependencyUuid
  );

  if (!targetAlreadyLinksDependency) {
    target.packageProductDependencies.push({
      value: dependencyUuid,
      comment: SPM_PRODUCT_NAME,
    });
  }
}

function withHaapiSpmEmbed(config) {
  return withXcodeProject(config, (configWithXcodeProject) => {
    const project = configWithXcodeProject.modResults;
    const packageReferenceUuid = ensureRemoteSwiftPackageReference(project);

    getApplicationTargetEntries(project).forEach(([, target]) => {
      ensureSwiftPackageProductDependency(project, packageReferenceUuid, target);
    });

    return configWithXcodeProject;
  });
}

module.exports = createRunOncePlugin(
  withHaapiSpmEmbed,
  pkg.name,
  pkg.version
);
module.exports.withHaapiSpmEmbed = withHaapiSpmEmbed;

