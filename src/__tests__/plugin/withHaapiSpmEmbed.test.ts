const withXcodeProjectMock = jest.fn((config, action) =>
  action({ ...config, modResults: config.modResults })
);

jest.mock('expo/config-plugins', () => ({
  createRunOncePlugin: (plugin: unknown) => plugin,
  withXcodeProject: (config: unknown, action: unknown) =>
    withXcodeProjectMock(config, action),
}));

// Load the real plugin file after the config-plugin mocks are installed.
const { withHaapiSpmEmbed } = require('../../../plugin/withHaapiSpmEmbed.js');

// The plugin pins the SPM dependency to the iOS HAAPI SDK version from the
// package.json source of truth. Assert against that value rather than a
// hardcoded literal so an iOS version bump can't silently leave these
// assertions stale.
const IOS_VERSION = require('../../../package.json').haapi.ios.version;

function createProjectFixture(): any {
  let nextUuid = 1;
  const projectSection: Record<string, any> = {
    PROJECT_1: {
      isa: 'PBXProject',
      packageReferences: [],
    },
    PROJECT_1_comment: 'Example',
  };

  const targetSection: Record<string, any> = {
    APP_TARGET: {
      productType: '"com.apple.product-type.application"',
      packageProductDependencies: [],
    },
    APP_TARGET_comment: 'ExampleApp',
    TEST_TARGET: {
      productType: '"com.apple.product-type.bundle.unit-test"',
      packageProductDependencies: [],
    },
    TEST_TARGET_comment: 'ExampleTests',
  };

  return {
    hash: { project: { objects: {} as Record<string, any> } },
    generateUuid() {
      const uuid = `UUID_${nextUuid}`;
      nextUuid += 1;
      return uuid;
    },
    // Mirror the real `xcode` lib: { uuid, firstProject: <PBXProject object> }.
    // The PBXProject object has no `.value`, so the plugin must resolve the
    // root project UUID via the `uuid` field — exercise that production path.
    getFirstProject() {
      return { uuid: 'PROJECT_1', firstProject: projectSection.PROJECT_1 };
    },
    pbxProjectSection() {
      return projectSection;
    },
    pbxNativeTargetSection() {
      return targetSection;
    },
  };
}

function nonCommentKeys(section: Record<string, unknown>) {
  return Object.keys(section).filter((key) => !key.endsWith('_comment'));
}

describe('withHaapiSpmEmbed', () => {
  beforeEach(() => {
    withXcodeProjectMock.mockClear();
  });

  it('adds the remote package reference and links IdsvrHaapiSdk on app targets', () => {
    const project = createProjectFixture();

    withHaapiSpmEmbed({ modResults: project });

    const remoteSection = project.hash.project.objects.XCRemoteSwiftPackageReference;
    const remoteUuids = nonCommentKeys(remoteSection);
    expect(remoteUuids).toHaveLength(1);

    const remote = remoteSection[remoteUuids[0]];
    expect(remote.repositoryURL).toBe(
      '"https://github.com/curityio/ios-idsvr-haapi-sdk-dist.git"'
    );
    expect(remote.requirement).toEqual({
      kind: 'exactVersion',
      version: IOS_VERSION,
    });

    const dependencySection =
      project.hash.project.objects.XCSwiftPackageProductDependency;
    const dependencyUuids = nonCommentKeys(dependencySection);
    expect(dependencyUuids).toHaveLength(1);

    const dependency = dependencySection[dependencyUuids[0]];
    expect(dependency.productName).toBe('"IdsvrHaapiSdk"');
    expect(dependency.package).toBe(remoteUuids[0]);

    const projectRef = project.pbxProjectSection().PROJECT_1.packageReferences;
    expect(projectRef).toHaveLength(1);
    expect(projectRef[0].value).toBe(remoteUuids[0]);

    const targets = project.pbxNativeTargetSection();
    expect(targets.APP_TARGET.packageProductDependencies).toHaveLength(1);
    expect(targets.TEST_TARGET.packageProductDependencies).toHaveLength(0);
  });

  it('is idempotent when applied repeatedly to the same project', () => {
    const project = createProjectFixture();

    withHaapiSpmEmbed({ modResults: project });
    withHaapiSpmEmbed({ modResults: project });

    const remoteSection = project.hash.project.objects.XCRemoteSwiftPackageReference;
    const dependencySection =
      project.hash.project.objects.XCSwiftPackageProductDependency;

    expect(nonCommentKeys(remoteSection)).toHaveLength(1);
    expect(nonCommentKeys(dependencySection)).toHaveLength(1);
    expect(project.pbxProjectSection().PROJECT_1.packageReferences).toHaveLength(1);
    expect(
      project.pbxNativeTargetSection().APP_TARGET.packageProductDependencies
    ).toHaveLength(1);
  });

  it('reuses existing references with non-.git URL and object refs', () => {
    const project = createProjectFixture();
    const existingPackageUuid = 'EXISTING_PKG';
    const existingDependencyUuid = 'EXISTING_DEP';

    project.hash.project.objects.XCRemoteSwiftPackageReference = {
      [existingPackageUuid]: {
        isa: 'XCRemoteSwiftPackageReference',
        repositoryURL: '"https://github.com/curityio/ios-idsvr-haapi-sdk-dist"',
        requirement: { kind: 'exactVersion', version: IOS_VERSION },
      },
      [`${existingPackageUuid}_comment`]: 'ios-idsvr-haapi-sdk-dist',
    };

    project.hash.project.objects.XCSwiftPackageProductDependency = {
      [existingDependencyUuid]: {
        isa: 'XCSwiftPackageProductDependency',
        productName: '"IdsvrHaapiSdk"',
        package: { value: existingPackageUuid, comment: 'ios-idsvr-haapi-sdk-dist' },
      },
      [`${existingDependencyUuid}_comment`]: 'IdsvrHaapiSdk',
    };

    project.pbxProjectSection().PROJECT_1.packageReferences = [
      { value: existingPackageUuid, comment: 'ios-idsvr-haapi-sdk-dist' },
    ];
    project.pbxNativeTargetSection().APP_TARGET.packageProductDependencies = [
      { value: existingDependencyUuid, comment: 'IdsvrHaapiSdk' },
    ];

    withHaapiSpmEmbed({ modResults: project });

    expect(
      nonCommentKeys(project.hash.project.objects.XCRemoteSwiftPackageReference)
    ).toHaveLength(1);
    expect(
      nonCommentKeys(project.hash.project.objects.XCSwiftPackageProductDependency)
    ).toHaveLength(1);
    expect(project.pbxProjectSection().PROJECT_1.packageReferences).toHaveLength(1);
    expect(
      project.pbxNativeTargetSection().APP_TARGET.packageProductDependencies
    ).toHaveLength(1);
  });

  it('repins a reused reference to the current package.json version', () => {
    const project = createProjectFixture();
    const existingPackageUuid = 'EXISTING_PKG';

    project.hash.project.objects.XCRemoteSwiftPackageReference = {
      [existingPackageUuid]: {
        isa: 'XCRemoteSwiftPackageReference',
        repositoryURL:
          '"https://github.com/curityio/ios-idsvr-haapi-sdk-dist.git"',
        // Stale pin left by a previous prebuild against an older SDK version.
        requirement: { kind: 'exactVersion', version: '5.0.0' },
      },
      [`${existingPackageUuid}_comment`]: 'ios-idsvr-haapi-sdk-dist',
    };
    project.pbxProjectSection().PROJECT_1.packageReferences = [
      { value: existingPackageUuid, comment: 'ios-idsvr-haapi-sdk-dist' },
    ];

    withHaapiSpmEmbed({ modResults: project });

    const remoteSection =
      project.hash.project.objects.XCRemoteSwiftPackageReference;
    expect(nonCommentKeys(remoteSection)).toHaveLength(1);
    expect(remoteSection[existingPackageUuid].requirement).toEqual({
      kind: 'exactVersion',
      version: IOS_VERSION,
    });
  });
});


