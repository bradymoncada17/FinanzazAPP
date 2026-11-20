SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.financial_snapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.financial_snapshots (
        user_id NVARCHAR(128) NOT NULL,
        data_key NVARCHAR(32) NOT NULL,
        payload NVARCHAR(MAX) NOT NULL,
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_financial_snapshots_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_financial_snapshots PRIMARY KEY (user_id, data_key),
        CONSTRAINT CK_financial_snapshots_payload_json CHECK (ISJSON(payload) = 1)
    );
END;

IF OBJECT_ID(N'dbo.app_users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_users (
        user_id NVARCHAR(128) NOT NULL,
        email NVARCHAR(254) NOT NULL,
        display_name NVARCHAR(80) NOT NULL,
        password_salt VARBINARY(16) NOT NULL,
        password_hash VARBINARY(32) NOT NULL,
        password_iterations INT NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_users_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_app_users PRIMARY KEY (user_id),
        CONSTRAINT UQ_app_users_email UNIQUE (email),
        CONSTRAINT CK_app_users_password_iterations CHECK (password_iterations >= 100000)
    );
END;

IF OBJECT_ID(N'dbo.app_sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.app_sessions (
        token_hash VARBINARY(32) NOT NULL,
        user_id NVARCHAR(128) NOT NULL,
        expires_at DATETIME2(3) NOT NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT DF_app_sessions_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_app_sessions PRIMARY KEY (token_hash),
        CONSTRAINT FK_app_sessions_app_users FOREIGN KEY (user_id) REFERENCES dbo.app_users(user_id) ON DELETE CASCADE
    );
    CREATE INDEX IX_app_sessions_expires_at ON dbo.app_sessions (expires_at);
END;

IF OBJECT_ID(N'dbo.lab_runs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.lab_runs (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_lab_runs PRIMARY KEY,
        lab_name NVARCHAR(100) NOT NULL,
        status NVARCHAR(40) NOT NULL,
        executed_at DATETIME2(3) NOT NULL CONSTRAINT DF_lab_runs_executed_at DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.lab_runs WHERE lab_name = N'FinanzApp Docker SQL Server')
BEGIN
    INSERT INTO dbo.lab_runs (lab_name, status)
    VALUES (N'FinanzApp Docker SQL Server', N'initialization-ok');
END;
