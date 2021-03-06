import {
  Button,
  CircularProgress,
  Link,
  makeStyles,
  Paper,
  Typography,
} from "@material-ui/core";
import SyncIcon from "@material-ui/icons/Cached";
import OpenInNewIcon from "@material-ui/icons/OpenInNew";
import Skeleton from "@material-ui/lab/Skeleton/Skeleton";
import dayjs from "dayjs";
import React, { FC, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link as RouterLink } from "react-router-dom";
import { PAGE_PATH_DEPLOYMENTS } from "../constants/path";
import { APPLICATION_KIND_TEXT } from "../constants/application-kind";
import { APPLICATION_SYNC_STATUS_TEXT } from "../constants/application-sync-status-text";
import { APPLICATION_HEALTH_STATUS_TEXT } from "../constants/health-status-text";
import { AppState } from "../modules";
import {
  Application,
  ApplicationDeploymentReference,
  selectById as selectApplicationById,
  syncApplication,
} from "../modules/applications";
import {
  ApplicationLiveState,
  selectById as selectLiveStateById,
} from "../modules/applications-live-state";
import {
  Environment,
  selectById as selectEnvById,
} from "../modules/environments";
import { Piped, selectById as selectPipeById } from "../modules/pipeds";
import { DetailTableRow } from "./detail-table-row";
import { ApplicationHealthStatusIcon } from "./health-status-icon";
import { SyncStateReason } from "./sync-state-reason";
import { SyncStatusIcon } from "./sync-status-icon";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    display: "flex",
    zIndex: theme.zIndex.appBar,
    position: "relative",
    flexDirection: "column",
  },
  nameAndEnv: {
    display: "flex",
    alignItems: "baseline",
  },
  mainContent: { flex: 1 },
  content: {
    flex: 1,
  },
  detail: {
    display: "flex",
    marginTop: theme.spacing(1),
  },
  loading: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  env: {
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
  },
  statusLine: {
    display: "flex",
    alignItems: "center",
  },
  statusText: {
    display: "flex",
    alignItems: "baseline",
  },
  syncStatusText: {
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(1),
  },
  actionButtons: {
    position: "absolute",
    right: theme.spacing(2),
    top: theme.spacing(2),
  },
  buttonProgress: {
    color: theme.palette.primary.main,
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
  linkIcon: {
    fontSize: 16,
    verticalAlign: "text-bottom",
    marginLeft: theme.spacing(0.5),
  },
  latestDeploymentTable: {
    paddingLeft: theme.spacing(2),
  },
  latestDeploymentHead: {
    display: "flex",
    alignItems: "baseline",
  },
  latestDeploymentLink: {
    marginLeft: theme.spacing(1),
  },
  popover: {
    pointerEvents: "none",
  },
  paper: {
    padding: theme.spacing(1),
  },
}));

interface Props {
  applicationId: string;
}

const useIsSyncingApplication = (applicationId: string | null): boolean => {
  return useSelector<AppState, boolean>((state) => {
    if (!applicationId) {
      return false;
    }

    return state.applications.syncing[applicationId];
  });
};

const MostRecentlySuccessfulDeployment: FC<{
  deployment?: ApplicationDeploymentReference.AsObject;
}> = ({ deployment }) => {
  const classes = useStyles();

  if (!deployment) {
    return <Skeleton height={63} width={500} />;
  }

  const date = dayjs(deployment.startedAt * 1000);

  return (
    <>
      <div className={classes.latestDeploymentHead}>
        <Typography variant="subtitle1">Latest Deployment</Typography>
        <Typography variant="body2" className={classes.latestDeploymentLink}>
          <Link
            component={RouterLink}
            to={`${PAGE_PATH_DEPLOYMENTS}/${deployment.deploymentId}`}
          >
            more details
          </Link>
        </Typography>
      </div>
      <table className={classes.latestDeploymentTable}>
        <tbody>
          <DetailTableRow
            label="Deployed At"
            value={<span title={date.format()}>{date.fromNow()}</span>}
          />
          <DetailTableRow label="Version" value={deployment.version} />
          <DetailTableRow label="Summary" value={deployment.summary} />
        </tbody>
      </table>
    </>
  );
};

export const ApplicationDetail: FC<Props> = memo(function ApplicationDetail({
  applicationId,
}) {
  const classes = useStyles();
  const dispatch = useDispatch();

  const app = useSelector<AppState, Application | undefined>((state) =>
    selectApplicationById(state.applications, applicationId)
  );
  const liveState = useSelector<AppState, ApplicationLiveState | undefined>(
    (state) => selectLiveStateById(state.applicationLiveState, applicationId)
  );
  const env = useSelector<AppState, Environment | undefined>((state) =>
    app ? selectEnvById(state.environments, app.envId) : undefined
  );
  const isSyncing = useIsSyncingApplication(app ? app.id : null);
  const pipe = useSelector<AppState, Piped | undefined>((state) =>
    app ? selectPipeById(state.pipeds, app.pipedId) : undefined
  );

  const handleSync = (): void => {
    if (app) {
      dispatch(syncApplication({ applicationId: app.id }));
    }
  };

  return (
    <Paper square elevation={1} className={classes.root}>
      <div className={classes.mainContent}>
        <div className={classes.nameAndEnv}>
          <Typography variant="h5">
            {app ? app.name : <Skeleton width={100} />}
          </Typography>
          <Typography variant="subtitle2" className={classes.env}>
            {env ? env.name : <Skeleton width={100} />}
          </Typography>
        </div>

        {app?.syncState ? (
          <>
            <div className={classes.statusLine}>
              <SyncStatusIcon status={app.syncState.status} />
              <div className={classes.statusText}>
                <Typography variant="h6" className={classes.syncStatusText}>
                  {APPLICATION_SYNC_STATUS_TEXT[app.syncState.status]}
                </Typography>
              </div>

              {liveState ? (
                <>
                  <ApplicationHealthStatusIcon
                    health={liveState.healthStatus}
                  />
                  <Typography variant="h6" className={classes.syncStatusText}>
                    {APPLICATION_HEALTH_STATUS_TEXT[liveState.healthStatus]}
                  </Typography>
                </>
              ) : (
                <Skeleton height={32} width={100} />
              )}
            </div>

            <SyncStateReason
              summary={app.syncState.shortReason}
              detail={app.syncState.reason}
            />
          </>
        ) : (
          <Skeleton height={32} width={200} />
        )}
      </div>

      <div className={classes.detail}>
        <div className={classes.content}>
          {app && pipe ? (
            <table>
              <tbody>
                <DetailTableRow
                  label="Kind"
                  value={APPLICATION_KIND_TEXT[app.kind]}
                />
                <DetailTableRow label="Piped" value={pipe.name} />
                <DetailTableRow
                  label="Cloud Provider"
                  value={app.cloudProvider}
                />

                {app.gitPath && (
                  <DetailTableRow
                    label="Configuration Directory"
                    value={
                      <Link
                        href={app.gitPath.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {app.gitPath.path}
                        <OpenInNewIcon className={classes.linkIcon} />
                      </Link>
                    }
                  />
                )}
              </tbody>
            </table>
          ) : (
            <Skeleton height={63} width={500} />
          )}
        </div>

        <div className={classes.content}>
          <MostRecentlySuccessfulDeployment
            deployment={app?.mostRecentlySuccessfulDeployment}
          />
        </div>
      </div>

      <div className={classes.actionButtons}>
        <Button
          variant="outlined"
          color="primary"
          onClick={handleSync}
          disabled={isSyncing}
          startIcon={<SyncIcon />}
        >
          SYNC
          {isSyncing && (
            <CircularProgress size={24} className={classes.buttonProgress} />
          )}
        </Button>
      </div>
    </Paper>
  );
});
